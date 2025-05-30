const express = require("express");
var cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middlewares
app.use(express.json());
app.use(cors());

const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).send({ message: "forbidden access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const isAdmin = user?.userType === "admin";
  if (!isAdmin) {
    res.status(403).send({ message: "forbidden access" });
  }
  next();
};
const verifyDeliveryMan = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const isDeliveryMan = user?.userType === "deliveryman";
  if (!isDeliveryMan) {
    res.status(403).send({ message: "forbidden access" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ctrkbrk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const database = client.db("TrackNGo");
    // Collections
    const userCollection = database.collection("users");
    const bookingCollection = database.collection("bookings");
    const reviewCollection = database.collection("reviews");
    const paymentCollection = database.collection("payments");

    // jwt implementation
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "6h",
      });
      res.send({ token });
    });

    //  User APIs
    app.get("/users",  async (req, res) => {
      let query = {};
      const totalUsers = await userCollection.countDocuments(query);
      const users = await userCollection.find(query).toArray();
      res.send({ users, totalUsers });
    });

    // app.get("/users/type/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   if (!user) {
    //     return res.status(404).send({ message: "User not found" });
    //   }
    //   console.log("user.userType", user.userType);
    //   res.send({ userType: user.userType });
    // });  

      app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      console.log("result", result);
      
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });


     app.patch("/users/:email", async (req, res) => {
      const user = req.body;
      const email = req.params.email;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          name: user.name,
          image: user.image,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //  admin APIs
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.userType === "admin";
      }
      res.send({ admin });
    });

    app.patch("/users/admin/:email", verifyToken,verifyAdmin, async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updatedDoc = {
          $set: {
            userType: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

   
    // Deliveryman APIs
        app.get("/users/deliverymans", verifyToken, verifyAdmin, async (req, res) => {
      const query = { userType: "deliveryman" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/users/deliveryman/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let deliveryMan = false;
      if (user) {
        deliveryMan = user?.userType === "deliveryman";
      }
      res.send({ deliveryMan });
    });

    app.patch("/users/deliveryman/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          userType: "deliveryman",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    //  parcel related api
    app.get("/parcels", async (req, res) => {
      const { from, to } = req.query;
      let query = {};

      if (from && to) {
        query.deliveryDate = {
          $gte: from,
          $lte: to,
        };
      }

      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/parcels/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/parcels/deliverylist/:id", async (req, res) => {
      const id = req.params.id;
      const query = { deliveryManId: id };
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/parcels/payment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await parcelCollection.findOne(query);
      res.send(result);
    });

    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      const result = await parcelCollection.insertOne(parcel);
      const email = parcel.email;
      const userUpdateResult = await userCollection.updateOne(
        { email: email }, 
        { $inc: { parcelBooked: 1 } } // Increment the parcelBooked count
      );
      res.send(result);
    });
    app.patch("/parcels/update/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const res1 = await parcelCollection.findOne(query);
      if (data.deliveryManId) {
        const updatedDoc = {
          $set: {
            ...res1,
            deliveryManId: data.deliveryManId,
            approximateDeliveryDate: data.approximateDeliveryDate,
            bookingStatus: data.bookingStatus,
          },
        };
        const result = await parcelCollection.updateOne(query, updatedDoc);
        res.send(result);
      } else {
        const updatedDoc = {
          $set: {
            deliveryAddress: data.deliveryAddress,
            deliveryDate: data.deliveryDate,
            deliveryLatitude: data.deliveryLatitude,
            deliveryLongitude: data.deliveryLongitude,
            email: data.email,
            name: data.name,
            parcelType: data.parcelType,
            parcelWeight: data.parcelWeight,
            phone: data.phone,
            price: data.price,
            receiversName: data.receiversName,
            receiversPhone: data.receiversPhone,
            bookingDate: data.bookingDate,
          },
        };
        const result = await parcelCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    });
    app.get("/parcels/update/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(query);
      res.send(result);
    });
    app.patch("/parcels/cancel/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { bookingStatus: "cancelled" },
      };
      const result = await parcelCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/parcels/deliver/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const parcel = await parcelCollection.findOne({ _id: new ObjectId(id) });

      const deliveryManId = parcel.deliveryManId;
      const deliveryMan = await usersCollection.findOne({
        _id: new ObjectId(deliveryManId),
      });

      const updateDeliveryMan = await usersCollection.updateOne(
        { _id: new ObjectId(deliveryManId) },
        { $inc: { parcelDelivered: 1 } }
      );

      const updateParcel = await parcelCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { bookingStatus: "delivered" } }
      );

      res.send(updateParcel);
    });
    app.get("/parcels/cancel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(query);
      res.send(result);
    });

    // Review APIs
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;
        const { deliveryManId, review: newReviewScore } = review;
        const reviewResult = await reviewCollection.insertOne(review);
        const deliveryMan = await usersCollection.findOne({
          _id: new ObjectId(deliveryManId),
        });

        const currentAverageReview = deliveryMan.averageReview;

        const updatedAverageReview =
          (parseInt(currentAverageReview) + parseInt(newReviewScore)) / 2;
        const updateResult = await usersCollection.updateOne(
          { _id: new ObjectId(deliveryManId) },
          {
            $set: { averageReview: updatedAverageReview },
          }
        );

        res.send(reviewResult);
      } catch (error) {
        console.error("Error while posting review:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { deliveryManId: id };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    // Payment intent API
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      res.send(paymentResult);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello People!");
});

app.listen(port, () => {
  console.log(`Parcel delivery service app listening on port ${port}`);
});
