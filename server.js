const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
var cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcrypt");
const Analyzer = require("./sentiment-analysis/sentiment-analysis");

require("events").EventEmitter.prototype._maxListeners = 100;

const pool = mysql.createPool({
	host: "localhost",
	port: "3306",
	user: "root",
	password: "admin",
	database: "reviewapplication",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

// await pool.connect(function (err) {
// 	if (err) throw err;
// 	console.log("Connected!");
// });

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const whitelist = ["http://localhost:8080"];
const corsOptions = {
	origin: function (origin, callback) {
		if (whitelist.indexOf(origin) !== -1 || origin === undefined) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS, origin: " + origin));
		}
	},
};

app.get("/", cors(corsOptions), (req, res, next) => {
	console.log("Test");
	res.send("<h1>Some html</h1>");
});

app.get("/restaurants", cors(corsOptions), async (req, res) => {
	const lat = parseFloat(req.query.lat);
	const lng = parseFloat(req.query.lng);

	axios
		.get(
			`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1500&type=restaurant&key=AIzaSyDrgODbH6IHZ-myEbrGfti-FfHrBv9X9WA`
		)
		.then((response) => {
			res.json(response.data.results);
		})
		.catch((error) => {
			console.log(error);
		});
});
app.get("/details", cors(corsOptions), async (req, res) => {
	const placeId = req.query.placeId;

	axios
		.get(
			`https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=AIzaSyDrgODbH6IHZ-myEbrGfti-FfHrBv9X9WA`
		)
		.then((response) => {
			res.json(response.data.result);
		})
		.catch((error) => {
			console.log(error);
		});
});

const getAllUsers = async () => {
	const result = await pool.query("SELECT * from users");
	return result[0];
};

const addUser = async ({ name, email, password, firstName, lastName }) => {
	const result = await pool.query("INSERT INTO users SET ?", {
		email,
		password,
		first_name: firstName,
		last_name: lastName,
	});
	return result;
};

app.post("/users", cors(corsOptions), async (req, res) => {
	try {
		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const user = {
			email: req.body.email,
			password: hashedPassword,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
		};
		const users = await getAllUsers();
		const exists = users.find((dbUser) => dbUser.email === user.email);
		res.contentType("application/json");

		if (exists) {
			res.status(500).send('{"message":"users-exists"}');
			return;
		}

		await addUser(user);

		res.status(201).send('{"message":"users-added"}');
	} catch (err) {
		console.log(err);

		res.status(500).send();
	}
});

app.post("/users/login", cors(corsOptions), async (req, res) => {
	const email = req.body.email;
	const users = await getAllUsers();
	const user = users.find((dbUser) => dbUser.email === email);

	res.contentType("application/json");

	if (!user) {
		return res.status(400).send('{"message": "Cannot find user"}');
	}
	try {
		if (await bcrypt.compare(req.body.password, user.password)) {
			res.send("Success");
		} else {
			res.send("Not Allowed");
		}
	} catch {
		res.status(500).send();
	}
});

app.post("/analyse", cors(corsOptions), (req, res) => {
	const text = req.body.text;
	const score = Analyzer.analyseText(text);

	if (score >= 5) {
		res.json("{sentiment: positive}");
	} else if (-5 < score < 5) {
		res.json("{sentiment: neutral}");
	} else {
		res.json("{sentiment: negative}");
	}
});

const port = process.env.PORT || 3001;

app.listen(port, () => console.log("Server started."));
