const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors")

// Configuration
const keys = require("./keys");

// Express app setup
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgre client setup
const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
})

pgClient.on("connect", () => {
  // Create table on initialization if not exist
  pgClient
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch(err => console.log(err))
})

// Redis client setup
const redis = require("redis");
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPubliser = redisClient.duplicate();

// Express routing
app.get("/", (req, res) => {
  res.send("Hi!")
})

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM values");

  res.send(values.rows);
})

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values)
  })
})

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if(parseInt(index) > 40) {
    return res.status(422).send("index too high")
  }

  // Note: worker will replace the value later
  redisClient.hset("values", index, "Nothing yet!");
  redisPubliser.publish("insert", index)
  pgClient.query("INSERT INTO values (number) VALUES($1)", [index]);

  res.send({ working: true })
})

app.listen(5000, () => {
  console.log("Listening on port 5000")
})
