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

    // application related apis

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
    app.get("/api/companies", async (req, res) => {
      const cursor = await companyCollection.find().skip(1);
      const result = await cursor.toArray();
      res.send(result);
    });

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
