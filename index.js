const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
const dotenv = require("dotenv");
const { create } = require("node:domain");
dotenv.config();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const logger = (req,res, next)=>{
  console.log("logger log", req.params)
  next()
}
const verifyToken = (req,res,next)=>{
  console.log("headers", req.headers)
  const authHeader = req.headers?.authorization
  if(!authHeader){
    return res.status(401).send({ message : "unauthorized access"})
  }

  const token = authHeader.split(" ")[1]

  if(!token){
    return res.status(401).send({ message : "unauthorized access"})
  }

  next()
}



const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("role");
    const JobCollection = db.collection("jobs");
    const companyCollection = db.collection("companies");
    const userCollection = db.collection("user");
    const applicationCollection = db.collection("applications");
    const planCollection = db.collection("plans")
    const subscriptionCollection = db.collection("subscription")
  
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
      { stripeSessionId: data.stripeSessionId },
      {
        $set: subsInfo,
      },
      {
        upsert: true,
      }
    );

    await userCollection.updateOne(
      { email: data.email },
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
      }
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
      (singlePlan) => String(singlePlan.id).toLowerCase() === planId
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
    });
  }
});

    // application related apis

app.get("/api/applications", async (req, res) => {
  try {
    const query = {};

    if (req.query.applicantId) {
      query.applicantId = req.query.applicantId;
    }

    if (req.query.jobId) {
      query.jobId = req.query.jobId;
    }


    const result = await applicationCollection
      .find(query)
      .toArray();

    res.json(result);
  } catch (error) {
    console.error("Applications fetch error:", error);

    res.status(500).json({
      message: "Failed to fetch applications.",
    });
  }
});
    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const newApplication = {
        ...application,
        createdAt: new Date(),
      };
      const result = await applicationCollection.insertOne(newApplication);
      res.send(result);
    });

    // user
    app.get("/api/users", async (req, res) => {
      const cursor = await userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/jobs", async (req, res) => {
      const query = {};

      if (req.query.companyId) {
        query["company.id"] = req.query.companyId;
      }

      if (req.query.status) {
        query.status = req.query.status;
      }

      const cursor = await JobCollection.find(query);

      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/api/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await JobCollection.findOne(query);
      res.send(result);
    });

    app.post("/api/jobs", async (req, res) => {
      const job = req.body;
      const newJob = {
        ...job,
        createdAt: new Date(),
      };
      const result = await JobCollection.insertOne(newJob);
      res.send(result);
    });

    // companies



    // app.get("/api/companies", async (req, res) => {
    //   const cursor = await companyCollection.find();
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });
//    app.get("/api/companies", async (req, res) => {
//   try {
//     const companies = await companyCollection.find().toArray();

//     for (const company of companies) {
//       const filter = {
//         "company.id": company._id.toString(),
//       };

//       const jobCount = await JobCollection.countDocuments(filter);

//       company.jobCount = jobCount;
//     }

//     res.send(companies);
//   } catch (error) {
//     console.error("Companies fetch error:", error);

//     res.status(500).json({
//       message: "Failed to fetch companies.",
//     });
//   }
// });


app.get("/api/companies",logger ,verifyToken,async (req, res) => {
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
    });
  }
});
// --------------
        app.get('/api/stats', async (req, res) => {
            const pipeline = [
                {
                    $group: {
                        _id: '$jobType',
                        count: {
                            $sum: 1
                        }
                    }
                },
                {
                    $project: {
                        jobType: '$_id',
                        _id: 0,
                        count: 1
                    }
                },
                {
                    $sort: { count: 1 }
                }
            ]

            const cursor = jobCollection.aggregate(pipeline);
            const result = await cursor.toArray();
            res.send(result);
        })
// -------------

    app.get("/api/my/companies", async (req, res) => {
      const query = {};

      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }

      const result = await companyCollection.findOne(query);

      res.json(result || null);
    });
    app.post("/api/companies", async (req, res) => {
      const company = req.body;
      const result = await companyCollection.insertOne(company);
      res.send(result);
    });

app.patch("/api/companies/:id", logger, verifyToken ,async (req, res) => {
  try {
    const id = req.params.id;
    const updatedCompany = req.body;

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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
