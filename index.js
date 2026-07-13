const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("role");

    const JobCollection = db.collection("jobs");
    const companyCollection = db.collection("companies");
    const userCollection = db.collection("user");
    const applicationCollection = db.collection("applications");
    const planCollection = db.collection("plans");
    const subscriptionCollection = db.collection("subscription");
    const sessionCollection = db.collection("session");


    // verification related
    const findUserById = async (userId) => {
      if (!userId) return null;

      const possibleIds = [userId];

      if (ObjectId.isValid(String(userId))) {
        possibleIds.push(new ObjectId(String(userId)));
      }

      return userCollection.findOne({
        $or: possibleIds.map((id) => ({ _id: id })),
      });
    };

    const verifyToken = async (req, res, next) => {
      try {
        const authHeader = req.headers?.authorization || "";
        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
          return res.status(401).json({
            message: "Unauthorized access.",
          });
        }

        const session = await sessionCollection.findOne({ token });

        if (!session) {
          return res.status(401).json({
            message: "Invalid or expired session.",
          });
        }

        if (
          session.expiresAt &&
          new Date(session.expiresAt).getTime() < Date.now()
        ) {
          return res.status(401).json({
            message: "Session expired.",
          });
        }

        const user = await findUserById(session.userId);

        if (!user) {
          return res.status(401).json({
            message: "Session user was not found.",
          });
        }

        req.user = user;
        req.session = session;

        next();
      } catch (error) {
        console.error("Token verification error:", error);

        res.status(500).json({
          message: "Failed to verify user.",
          error: error.message,
        });
      }
    };

    const verifySeeker = async (req, res, next) => {
      if (req.user?.role !== "seeker") {
        return res.status(403).send({
          message: "forbidden access",
        });
      }

      next();
    };

    const verifyAdmin = async (req, res, next) => {
      if (req?.user?.role !== "admin") {
        return res.status(403).send({
          message: "forbidden access",
        });
      }

      next();
    };


    const verifyRecruiter = async (req, res, next) => {
      if (req.user?.role !== "recruiter") {
        return res.status(403).json({
          message: "Recruiter access required.",
        });
      }

      next();
    };

    const APPLICATION_STATUSES = [
      "applied",
      "reviewing",
      "shortlisted",
      "interview",
      "hired",
      "rejected",
    ];

    const normalizeApplicationStatus = (status) => {
      const value = String(status || "applied").toLowerCase();

      if (value === "new" || value === "pending") return "applied";
      if (value === "approved") return "shortlisted";
      if (value === "accepted") return "hired";
      if (value === "interviewing") return "interview";
      if (value === "cancelled") return "rejected";

      return APPLICATION_STATUSES.includes(value) ? value : "applied";
    };

    const buildFlexibleIdValues = (value) => {
      if (!value) return [];

      const values = [String(value)];

      if (ObjectId.isValid(String(value))) {
        values.push(new ObjectId(String(value)));
      }

      return values;
    };

    const getRecruiterCompany = async (user) => {
      const recruiterId = String(user?._id || "");

      const orConditions = [
        { recruiterId },
        { recruiterEmail: user?.email },
        { ownerEmail: user?.email },
      ].filter((condition) => {
        const value = Object.values(condition)[0];
        return Boolean(value);
      });

      if (ObjectId.isValid(recruiterId)) {
        orConditions.push({
          recruiterId: new ObjectId(recruiterId),
        });
      }

      if (!orConditions.length) return null;

      return companyCollection.findOne({
        $or: orConditions,
      });
    };

    const findJobByAnyId = async (jobId) => {
      if (!jobId) return null;

      const possibleIds = buildFlexibleIdValues(jobId);

      return JobCollection.findOne({
        $or: possibleIds.map((id) => ({ _id: id })),
      });
    };

    const seekerOwnsApplication = (application, user) => {
      const userId = String(user?._id || "");
      const userEmail = String(user?.email || "").toLowerCase();

      const applicantId = String(
        application?.applicantId ||
          application?.userId ||
          application?.applicant?._id ||
          application?.applicant?.id ||
          "",
      );

      const applicantEmail = String(
        application?.applicantEmail ||
          application?.email ||
          application?.applicant?.email ||
          "",
      ).toLowerCase();

      return (
        applicantId === userId ||
        (Boolean(userEmail) && applicantEmail === userEmail)
      );
    };

    const enrichSeekerApplication = async (application) => {
      const jobId =
        application?.jobId ||
        application?.job?._id ||
        application?.job?.id;

      const job = await findJobByAnyId(jobId);

      return {
        ...application,
        status: normalizeApplicationStatus(application?.status),
        job: job
          ? {
              _id: job._id,
              title: job.title,
              category: job.category,
              type: job.type,
              experienceLevel: job.experienceLevel,
              location: job.location,
              company: job.company,
              salary: job.salary,
              skills: job.skills,
              status: job.status,
            }
          : application?.job || null,
        jobTitle:
          application?.jobTitle ||
          application?.position ||
          job?.title ||
          "",
        jobCategory:
          application?.jobCategory ||
          job?.category ||
          "",
        jobType:
          application?.jobType ||
          job?.type ||
          "",
        companyId:
          application?.companyId ||
          job?.company?.id ||
          "",
        companyName:
          application?.companyName ||
          job?.company?.name ||
          "",
        companyLocation:
          application?.companyLocation ||
          job?.location?.display ||
          job?.location?.city ||
          "",
      };
    };

    // subscription
    app.post("/api/subscription", async (req, res) => {
      try {
        const data = req.body;

        if (!data?.email) {
          return res.status(400).json({
            message: "Email is required.",
          });
        }

        if (!data?.planId) {
          return res.status(400).json({
            message: "Plan ID is required.",
          });
        }

        const subsInfo = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await subscriptionCollection.updateOne(
          {
            stripeSessionId: data.stripeSessionId,
          },
          {
            $set: subsInfo,
          },
          {
            upsert: true,
          },
        );

        await userCollection.updateOne(
          {
            email: data.email,
          },
          {
            $set: {
              plan: data.planId,
              subscription: {
                planId: data.planId,
                planName: data.planName,
                stripeSessionId: data.stripeSessionId,
                stripeCustomerId: data.stripeCustomerId,
                stripeSubscriptionId: data.stripeSubscriptionId,
                paymentStatus: data.paymentStatus,
                amountTotal: data.amountTotal,
                currency: data.currency,
                updatedAt: new Date(),
              },
            },
          },
        );

        res.json({
          success: true,
          message: "Subscription saved successfully.",
          result,
        });
      } catch (error) {
        console.error("Subscription create error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to save subscription.",
          error: error.message,
        });
      }
    });

    // plans
    app.get("/api/plans", async (req, res) => {
      try {
        const planId = req.query.plan_id
          ? String(req.query.plan_id).toLowerCase()
          : "";

        const plansDoc = await planCollection.findOne({});

        if (!plansDoc) {
          return res.status(404).json({
            message: "Plans document not found",
          });
        }

        const allPlans = [
          ...(plansDoc.seekerPlans || []),
          ...(plansDoc.recruiterPlans || []),
        ];

        if (!planId) {
          return res.json(allPlans);
        }

        const plan = allPlans.find(
          (singlePlan) => String(singlePlan.id).toLowerCase() === planId,
        );

        if (!plan) {
          return res.status(404).json({
            message: "Plan not found",
          });
        }

        res.json(plan);
      } catch (error) {
        console.error("Plan fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch plan.",
          error: error.message,
        });
      }
    });


    // applications: seeker list with current job information
    app.get("/api/applications", verifyToken, verifySeeker, async (req, res) => {
      try {
        const ownApplicantId = String(req.user._id);

        if (
          req.query.applicantId &&
          String(req.query.applicantId) !== ownApplicantId
        ) {
          return res.status(403).json({
            message: "You can only view your own applications.",
          });
        }

        const applicantIds = buildFlexibleIdValues(ownApplicantId);

        const query = {
          $or: [
            ...applicantIds.map((id) => ({ applicantId: id })),
            { applicantEmail: req.user.email },
            { email: req.user.email },
            { "applicant.email": req.user.email },
          ],
        };

        if (req.query.jobId) {
          query.jobId = {
            $in: buildFlexibleIdValues(req.query.jobId),
          };
        }

        const applications = await applicationCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        const enrichedApplications = await Promise.all(
          applications.map(enrichSeekerApplication),
        );

        res.json(enrichedApplications);
      } catch (error) {
        console.error("Applications fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch applications.",
          error: error.message,
        });
      }
    });

    // applications: seeker can view only one of their own applications
    app.get(
      "/api/applications/:id",
      verifyToken,
      verifySeeker,
      async (req, res) => {
        try {
          const applicationId = req.params.id;

          if (!ObjectId.isValid(applicationId)) {
            return res.status(400).json({
              message: "Invalid application ID.",
            });
          }

          const application = await applicationCollection.findOne({
            _id: new ObjectId(applicationId),
          });

          if (!application) {
            return res.status(404).json({
              message: "Application was not found.",
            });
          }

          if (!seekerOwnsApplication(application, req.user)) {
            return res.status(403).json({
              message: "You cannot view this application.",
            });
          }

          const enrichedApplication =
            await enrichSeekerApplication(application);

          res.json(enrichedApplication);
        } catch (error) {
          console.error("Application details fetch error:", error);

          res.status(500).json({
            message: "Failed to fetch application details.",
            error: error.message,
          });
        }
      },
    );

    // Existing frontend compatibility is kept here.
    // Later, add verifyToken + verifySeeker after the Apply Job form sends a Bearer token.
    app.post("/api/applications", async (req, res) => {
      try {
        const application = req.body || {};
        const applicantId =
          application.applicantId ||
          application.userId ||
          application.applicant?._id ||
          application.applicant?.id;
        const jobId =
          application.jobId ||
          application.job?._id ||
          application.job?.id;

        if (!applicantId) {
          return res.status(400).json({
            message: "Applicant ID is required.",
          });
        }

        if (!jobId || !ObjectId.isValid(String(jobId))) {
          return res.status(400).json({
            message: "A valid job ID is required.",
          });
        }

        const job = await JobCollection.findOne({
          _id: new ObjectId(String(jobId)),
        });

        if (!job) {
          return res.status(404).json({
            message: "Job not found.",
          });
        }

        const duplicateApplication = await applicationCollection.findOne({
          jobId: {
            $in: buildFlexibleIdValues(jobId),
          },
          applicantId: {
            $in: buildFlexibleIdValues(applicantId),
          },
        });

        if (duplicateApplication) {
          return res.status(409).json({
            message: "You have already applied for this job.",
          });
        }

        const now = new Date();

        const newApplication = {
          ...application,
          applicantId: String(applicantId),
          jobId: String(jobId),
          applicantName:
            application.applicantName ||
            application.candidateName ||
            application.name ||
            application.applicant?.name ||
            "",
          applicantEmail:
            application.applicantEmail ||
            application.email ||
            application.applicant?.email ||
            "",
          jobTitle:
            application.jobTitle ||
            application.position ||
            job.title ||
            "",
          companyId:
            application.companyId ||
            job.company?.id ||
            "",
          companyName:
            application.companyName ||
            job.company?.name ||
            "",
          status: "applied",
          statusHistory: [
            {
              status: "applied",
              changedAt: now,
              changedBy: String(applicantId),
            },
          ],
          createdAt: now,
          updatedAt: now,
        };

        const result = await applicationCollection.insertOne(newApplication);

        res.status(201).json({
          success: true,
          message: "Application submitted successfully.",
          insertedId: result.insertedId,
          application: {
            ...newApplication,
            _id: result.insertedId,
          },
        });
      } catch (error) {
        console.error("Application create error:", error);

        res.status(500).json({
          message: "Failed to submit application.",
          error: error.message,
        });
      }
    });

    // recruiter applications list
    app.get(
      "/api/recruiter/applications",
      verifyToken,
      verifyRecruiter,
      async (req, res) => {
        try {
          const company = await getRecruiterCompany(req.user);

          if (!company) {
            return res.json({
              applications: [],
              jobs: [],
              company: null,
              stats: {
                total: 0,
                applied: 0,
                reviewing: 0,
                shortlisted: 0,
                interview: 0,
                hired: 0,
                rejected: 0,
              },
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            });
          }

          const companyId = company._id.toString();

          const companyJobs = await JobCollection.find({
            $or: [
              { "company.id": companyId },
              { companyId },
              { "company._id": company._id },
            ],
          })
            .project({
              title: 1,
              status: 1,
              company: 1,
              createdAt: 1,
            })
            .sort({ createdAt: -1 })
            .toArray();

          const jobIdValues = companyJobs.flatMap((job) =>
            buildFlexibleIdValues(job._id),
          );

          if (!jobIdValues.length) {
            return res.json({
              applications: [],
              jobs: companyJobs,
              company,
              stats: {
                total: 0,
                applied: 0,
                reviewing: 0,
                shortlisted: 0,
                interview: 0,
                hired: 0,
                rejected: 0,
              },
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            });
          }

          const rawApplications = await applicationCollection
            .find({
              $or: [
                { jobId: { $in: jobIdValues } },
                { "job.id": { $in: jobIdValues } },
                { "job._id": { $in: jobIdValues } },
              ],
            })
            .sort({ createdAt: -1 })
            .toArray();

          const applicantIdValues = rawApplications.flatMap((application) =>
            buildFlexibleIdValues(
              application.applicantId ||
                application.userId ||
                application.applicant?._id ||
                application.applicant?.id,
            ),
          );

          const applicantEmails = rawApplications
            .map(
              (application) =>
                application.applicantEmail ||
                application.email ||
                application.applicant?.email,
            )
            .filter(Boolean);

          const userOrConditions = [];

          if (applicantIdValues.length) {
            userOrConditions.push({
              _id: { $in: applicantIdValues },
            });
          }

          if (applicantEmails.length) {
            userOrConditions.push({
              email: { $in: applicantEmails },
            });
          }

          const applicants = userOrConditions.length
            ? await userCollection
                .find({
                  $or: userOrConditions,
                })
                .project({
                  name: 1,
                  email: 1,
                  image: 1,
                  phone: 1,
                })
                .toArray()
            : [];

          const applicantById = new Map();
          const applicantByEmail = new Map();

          applicants.forEach((applicant) => {
            applicantById.set(String(applicant._id), applicant);
            applicantByEmail.set(String(applicant.email || "").toLowerCase(), applicant);
          });

          const jobMap = new Map(
            companyJobs.map((job) => [String(job._id), job]),
          );

          const enrichedApplications = rawApplications.map((application) => {
            const applicantId = String(
              application.applicantId ||
                application.userId ||
                application.applicant?._id ||
                application.applicant?.id ||
                "",
            );

            const applicantEmail = String(
              application.applicantEmail ||
                application.email ||
                application.applicant?.email ||
                "",
            ).toLowerCase();

            const jobId = String(
              application.jobId ||
                application.job?._id ||
                application.job?.id ||
                "",
            );

            const databaseApplicant =
              applicantById.get(applicantId) ||
              applicantByEmail.get(applicantEmail);

            const applicant = databaseApplicant || {
              _id: applicantId || null,
              name:
                application.applicantName ||
                application.candidateName ||
                application.name ||
                application.applicant?.name ||
                "Unnamed candidate",
              email:
                application.applicantEmail ||
                application.email ||
                application.applicant?.email ||
                "No email",
              image:
                application.applicantImage ||
                application.applicant?.image ||
                null,
              phone:
                application.phone ||
                application.applicant?.phone ||
                null,
            };

            const job = jobMap.get(jobId) || {
              _id: jobId || null,
              title:
                application.jobTitle ||
                application.position ||
                application.job?.title ||
                "Untitled job",
            };

            return {
              ...application,
              status: normalizeApplicationStatus(application.status),
              applicant,
              job,
            };
          });

          const stats = {
            total: enrichedApplications.length,
            applied: 0,
            reviewing: 0,
            shortlisted: 0,
            interview: 0,
            hired: 0,
            rejected: 0,
          };

          enrichedApplications.forEach((application) => {
            const status = normalizeApplicationStatus(application.status);
            stats[status] += 1;
          });

          const statusFilter = String(req.query.status || "").toLowerCase();
          const jobIdFilter = String(req.query.jobId || "");
          const searchFilter = String(req.query.search || "")
            .trim()
            .toLowerCase();

          let filteredApplications = enrichedApplications;

          if (statusFilter && statusFilter !== "all") {
            filteredApplications = filteredApplications.filter(
              (application) =>
                normalizeApplicationStatus(application.status) === statusFilter,
            );
          }

          if (jobIdFilter && jobIdFilter !== "all") {
            filteredApplications = filteredApplications.filter(
              (application) => String(application.job?._id || "") === jobIdFilter,
            );
          }

          if (searchFilter) {
            filteredApplications = filteredApplications.filter((application) => {
              const searchableText = [
                application.applicant?.name,
                application.applicant?.email,
                application.applicant?.phone,
                application.job?.title,
                Array.isArray(application.skills)
                  ? application.skills.join(" ")
                  : application.skills,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

              return searchableText.includes(searchFilter);
            });
          }

          const page = Math.max(Number(req.query.page) || 1, 1);
          const limit = Math.min(
            Math.max(Number(req.query.limit) || 20, 1),
            100,
          );
          const total = filteredApplications.length;
          const totalPages = Math.max(1, Math.ceil(total / limit));
          const skip = (page - 1) * limit;

          res.json({
            applications: filteredApplications.slice(skip, skip + limit),
            jobs: companyJobs,
            company,
            stats,
            pagination: {
              page,
              limit,
              total,
              totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1,
            },
          });
        } catch (error) {
          console.error("Recruiter applications fetch error:", error);

          res.status(500).json({
            message: "Failed to fetch recruiter applications.",
            error: error.message,
          });
        }
      },
    );

    // recruiter application status update
    app.patch(
      "/api/applications/:id/status",
      verifyToken,
      verifyRecruiter,
      async (req, res) => {
        try {
          const applicationId = req.params.id;
          const requestedStatus = String(req.body?.status || "").toLowerCase();

          if (!ObjectId.isValid(applicationId)) {
            return res.status(400).json({
              message: "Invalid application ID.",
            });
          }

          if (!APPLICATION_STATUSES.includes(requestedStatus)) {
            return res.status(400).json({
              message: "Invalid application status.",
              allowedStatuses: APPLICATION_STATUSES,
            });
          }

          const company = await getRecruiterCompany(req.user);

          if (!company) {
            return res.status(404).json({
              message: "Recruiter company was not found.",
            });
          }

          const application = await applicationCollection.findOne({
            _id: new ObjectId(applicationId),
          });

          if (!application) {
            return res.status(404).json({
              message: "Application was not found.",
            });
          }

          const jobId =
            application.jobId ||
            application.job?._id ||
            application.job?.id;

          const job = await findJobByAnyId(jobId);

          if (!job) {
            return res.status(404).json({
              message: "The related job was not found.",
            });
          }

          const jobCompanyId = String(
            job.company?.id ||
              job.companyId ||
              job.company?._id ||
              "",
          );

          if (jobCompanyId !== company._id.toString()) {
            return res.status(403).json({
              message: "You cannot manage this application.",
            });
          }

          const now = new Date();

          await applicationCollection.updateOne(
            {
              _id: new ObjectId(applicationId),
            },
            {
              $set: {
                status: requestedStatus,
                updatedAt: now,
              },
              $push: {
                statusHistory: {
                  status: requestedStatus,
                  changedAt: now,
                  changedBy: String(req.user._id),
                  changedByEmail: req.user.email,
                },
              },
            },
          );

          const updatedApplication = await applicationCollection.findOne({
            _id: new ObjectId(applicationId),
          });

          res.json({
            success: true,
            message: "Application status updated successfully.",
            application: updatedApplication,
          });
        } catch (error) {
          console.error("Application status update error:", error);

          res.status(500).json({
            message: "Failed to update application status.",
            error: error.message,
          });
        }
      },
    );

    // jobs with pagination
    app.get("/api/jobs", async (req, res) => {
      try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 9, 1), 50);
        const skip = (page - 1) * limit;

        const query = {};

        if (req.query.companyId) {
          query["company.id"] = req.query.companyId;
        }

        if (req.query.status) {
          query.status = req.query.status;
        }

        if (req.query.category && req.query.category !== "all") {
          query.category = req.query.category;
        }

        if (req.query.type && req.query.type !== "all") {
          query.type = req.query.type;
        }

        if (req.query.experienceLevel && req.query.experienceLevel !== "all") {
          query.experienceLevel = req.query.experienceLevel;
        }

        if (req.query.workMode && req.query.workMode !== "all") {
          query["location.type"] = req.query.workMode;
        }

        if (req.query.company && req.query.company !== "all") {
          query["company.name"] = req.query.company;
        }

        if (req.query.search) {
          const search = String(req.query.search).trim();
          const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const searchRegex = new RegExp(safeSearch, "i");

          query.$or = [
            {
              title: searchRegex,
            },
            {
              category: searchRegex,
            },
            {
              type: searchRegex,
            },
            {
              experienceLevel: searchRegex,
            },
            {
              "location.display": searchRegex,
            },
            {
              "company.name": searchRegex,
            },
            {
              "company.industryLabel": searchRegex,
            },
            {
              skills: searchRegex,
            },
          ];
        }

        const totalJobs = await JobCollection.countDocuments(query);

        const jobs = await JobCollection.find(query)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalPages = Math.max(1, Math.ceil(totalJobs / limit));

        res.json({
          jobs,
          pagination: {
            page,
            limit,
            totalJobs,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        });
      } catch (error) {
        console.error("Jobs fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch jobs.",
          error: error.message,
        });
      }
    });

    app.get("/api/jobs/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            message: "Invalid job id.",
          });
        }

        const query = {
          _id: new ObjectId(id),
        };

        const result = await JobCollection.findOne(query);

        if (!result) {
          return res.status(404).json({
            message: "Job not found.",
          });
        }

        res.send(result);
      } catch (error) {
        console.error("Job details fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch job details.",
          error: error.message,
        });
      }
    });

    app.post("/api/jobs", async (req, res) => {
      try {
        const job = req.body;

        const newJob = {
          ...job,
          createdAt: new Date(),
        };

        const result = await JobCollection.insertOne(newJob);

        res.send(result);
      } catch (error) {
        console.error("Job create error:", error);

        res.status(500).json({
          message: "Failed to create job.",
          error: error.message,
        });
      }
    });

    // companies
    app.get("/api/companies", verifyToken, async (req, res) => {
      try {
        const companies = await companyCollection.find().toArray();

        for (const company of companies) {
          const filter = {
            "company.id": company._id.toString(),
          };

          const jobCount = await JobCollection.countDocuments(filter);

          company.jobCount = jobCount;
        }

        res.send(companies);
      } catch (error) {
        console.error("Companies fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch companies.",
          error: error.message,
        });
      }
    });

    app.get("/api/my/companies", async (req, res) => {
      try {
        const query = {};

        if (req.query.recruiterId) {
          query.recruiterId = req.query.recruiterId;
        }

        const result = await companyCollection.findOne(query);

        res.json(result || null);
      } catch (error) {
        console.error("My company fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch company.",
          error: error.message,
        });
      }
    });

    app.post("/api/companies", async (req, res) => {
      try {
        const company = req.body;

        const newCompany = {
          ...company,
          createdAt: company?.createdAt || new Date(),
          updatedAt: new Date(),
        };

        const result = await companyCollection.insertOne(newCompany);

        res.send(result);
      } catch (error) {
        console.error("Company create error:", error);

        res.status(500).json({
          message: "Failed to create company.",
          error: error.message,
        });
      }
    });

    app.patch("/api/companies/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedCompany = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            message: "Invalid company id.",
          });
        }

        const allowedStatuses = ["pending", "approved", "rejected"];

        if (
          updatedCompany?.status &&
          !allowedStatuses.includes(updatedCompany.status)
        ) {
          return res.status(400).json({
            message: "Invalid company status.",
          });
        }

        const filter = {
          _id: new ObjectId(id),
        };

        const updatedDoc = {
          $set: {
            status: updatedCompany.status,
            updatedAt: new Date(),
          },
        };

        const result = await companyCollection.updateOne(filter, updatedDoc);

        res.json(result);
      } catch (error) {
        console.error("Company update error:", error);

        res.status(500).json({
          message: "Failed to update company.",
          error: error.message,
        });
      }
    });

    // stats
    app.get("/api/stats", async (req, res) => {
      try {
        const pipeline = [
          {
            $group: {
              _id: "$type",
              count: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              jobType: "$_id",
              _id: 0,
              count: 1,
            },
          },
          {
            $sort: {
              count: 1,
            },
          },
        ];

        const cursor = JobCollection.aggregate(pipeline);
        const result = await cursor.toArray();

        res.send(result);
      } catch (error) {
        console.error("Stats fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch stats.",
          error: error.message,
        });
      }
    });

    // await client.db("admin").command({ping: 1,});

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Rolebix server running on port ${port}`);
});