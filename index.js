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
    await client.connect();

    const db = client.db("role");

    const JobCollection = db.collection("jobs");
    const companyCollection = db.collection("companies");
    const userCollection = db.collection("user");
    const applicationCollection = db.collection("applications");
    const planCollection = db.collection("plans");
    const subscriptionCollection = db.collection("subscription");
    const sessionCollection = db.collection("session");

    // verification related
    const verifyToken = async (req, res, next) => {
      try {
        const authHeader = req.headers?.authorization;

        if (!authHeader) {
          return res.status(401).send({
            message: "unauthorized access",
          });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
          return res.status(401).send({
            message: "unauthorized access",
          });
        }

        const session = await sessionCollection.findOne({
          token,
        });

        if (!session) {
          return res.status(401).send({
            message: "unauthorized access",
          });
        }

        const userId = session?.userId;

        const user = await userCollection.findOne({
          _id: userId,
        });

        if (!user) {
          return res.status(401).send({
            message: "unauthorized access",
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

    // applications
    app.get("/api/applications", verifyToken, verifySeeker, async (req, res) => {
      try {
        const query = {};

        if (req.query.applicantId) {
          query.applicantId = req.query.applicantId;

          if (req.user._id.toString() !== req.query.applicantId) {
            return res.status(403).send({
              message: "forbidden",
            });
          }
        }

        if (req.query.jobId) {
          query.jobId = req.query.jobId;
        }

        const result = await applicationCollection.find(query).toArray();

        res.json(result);
      } catch (error) {
        console.error("Applications fetch error:", error);

        res.status(500).json({
          message: "Failed to fetch applications.",
          error: error.message,
        });
      }
    });

    app.post("/api/applications", async (req, res) => {
      try {
        const application = req.body;

        const newApplication = {
          ...application,
          createdAt: new Date(),
        };

        const result = await applicationCollection.insertOne(newApplication);

        res.send(result);
      } catch (error) {
        console.error("Application create error:", error);

        res.status(500).json({
          message: "Failed to submit application.",
          error: error.message,
        });
      }
    });

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