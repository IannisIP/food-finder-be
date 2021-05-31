const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
var cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcrypt");
const Analyzer = require("./sentiment-analysis/sentiment-analysis");
const jwt = require("jsonwebtoken");
const config = require("./config");
const Storage = require("./storage");
const pify = require("pify");
const DBHelpers = require("./helpers");

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

const computeSentiment = (score) => {
	let sentiment = "";
	if (score > 2) {
		sentiment = "positive";
	} else if (-2 < score && score < 2) {
		sentiment = "neutral";
	} else {
		sentiment = "negative";
	}
	return sentiment;
};

// const translateText = async (text) => {
// 	try {
// 		const response = await axios.get(
// 			`https://api-translate.systran.net/translation/text/translate?source=auto&target=en&input=${text}&key=04a36ab1-e9fb-4984-ab03-ef9f0de59971`
// 		);
// 		const jsonResponse = await response.data;
// 		return jsonResponse.outputs[0].output;
// 	} catch (e) {
// 		//throws if text is already in english.
// 	}
// };

const asyncForEach = async (array, callback) => {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
};

const addReviewSentiment = async (reviews) => {
	await asyncForEach(reviews, async (review) => {
		//const translatedReview = await translateText(review.text);
		//const score = Analyzer.analyseText(translatedReview || review.text);
		const score = Analyzer.analyseText(review.text);
		review.sentiment = computeSentiment(score);

		if (review.rating === undefined) {
			review.rating =
				review.sentiment === "positive"
					? 5
					: review.sentiment === "neutral"
					? 3
					: 1;
		}
	});
};

const getPlaceDetails = async (placeId) => {
	try {
		const response = await axios.get(
			`https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=AIzaSyDrgODbH6IHZ-myEbrGfti-FfHrBv9X9WA`
		);
		const placeDetails = response.data.result;

		const users = await DBHelpers.getAllUsers(pool);
		const reviews = await DBHelpers.getReviewsByPlaceId(
			pool,
			placeDetails.reference
		);

		const userReviews = reviews.map((review) => {
			const user = users.find((user) => user.id === review.userId);

			return {
				author_name: `${user["first_name"]} ${user["last_name"]}`,
				text: review.text,
				confirmed: review.receipt ? true : false,
				source: "db",
				reviewId: review.id,
			};
		});

		placeDetails.reviews = [...placeDetails.reviews, ...userReviews];

		if (placeDetails.reviews.length) {
			await addReviewSentiment(placeDetails.reviews);
		}

		return placeDetails;
	} catch (e) {
		return e;
	}
};

app.get("/details", cors(corsOptions), async (req, res) => {
	const placeId = req.query.placeId;
	const placeDetails = await getPlaceDetails(placeId);
	if (placeDetails) {
		res.status(200).json(placeDetails);
	} else {
		res.status(500).json(placeDetails);
	}
});

app.post("/users", cors(corsOptions), async (req, res) => {
	try {
		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const user = {
			email: req.body.email,
			password: hashedPassword,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
		};
		const users = await DBHelpers.getAllUsers(pool);
		const exists = users.find((dbUser) => dbUser.email === user.email);
		res.contentType("application/json");

		if (exists) {
			res.status(500).send('{"message":"users-exists"}');
			return;
		}

		const token = jwt.sign({ email: user.email }, config.secret, {
			expiresIn: 86400, // expires in 24 hours
		});

		await DBHelpers.addUser(pool, user);
		res
			.status(200)
			.send({ message: "user-added", auth: true, token: token, user: user });
	} catch (err) {
		console.log(err);

		res.status(500).send();
	}
});

app.get("/users/login");

app.post("/users/login", cors(corsOptions), async (req, res) => {
	const email = req.body.email;
	const users = await DBHelpers.getAllUsers(pool);
	const user = users.find((dbUser) => dbUser.email === email);

	res.contentType("application/json");

	if (!user) {
		return res.status(400).send('{"message": "Cannot find user"}');
	}
	try {
		const passwordIsValid = bcrypt.compareSync(
			req.body.password,
			user.password
		);
		if (passwordIsValid) {
			let token = jwt.sign({ email: user.email }, config.secret, {
				expiresIn: 86400, // expires in 24 hours
			});
			res
				.status(200)
				.send({ message: "Auth ok", auth: true, token: token, user: user });
		} else {
			res.status(401).send({
				message: "Username or password wrong",
				auth: false,
				token: null,
			});
		}
	} catch (e) {
		res.status(500).send(e);
	}
});

const validateUser = async (token) => {
	if (!token) return { auth: false, message: "No token provided." };

	return await new Promise((resolve) => {
		jwt.verify(token, config.secret, async (err, userInfo) => {
			if (err)
				return resolve({
					auth: false,
					message: "Failed to authenticate token.",
				});

			const users = await DBHelpers.getAllUsers(pool);
			const user = users.find((user) => user.email === userInfo.email);

			resolve(user);
		});
	});
};

const validJWTNeeded = (req, res, next) => {
	if (req.headers["x-access-token"]) {
		try {
			let authorization = req.headers["x-access-token"];
			req.jwt = jwt.verify(authorization, config.secret);

			return next();
		} catch (err) {
			return res.status(403).send();
		}
	} else {
		return res.status(401).send();
	}
};

app.get("/user-info", async (req, res) => {
	const token = req.headers["x-access-token"];
	const results = await validateUser(token);

	if (results.message === "No token provided.") {
		return res.status(401).send(results);
	} else if (results.message === "Failed to authenticate token.") {
		return res.status(500).send(results);
	}

	res.status(200).send(results);
});

app.post("/analyse", cors(corsOptions), (req, res) => {
	const text = req.body.text;
	const score = Analyzer.analyseText(text);

	const sentiment = computeSentiment(score);

	res.json(`{sentiment: ${sentiment}}`);
});

app.post("/reviews/pending", cors(corsOptions), async (req, res) => {
	const token = req.headers["x-access-token"];
	const user = await validateUser(token);
	const multerInstance = pify(Storage.upload(user.id).single("receipt"));

	try {
		await multerInstance(req, res);
	} catch (err) {
		console.log(err);
		// An error occurred when uploading
	}

	const review = {
		userId: user.id,
		placeId: req.body.placeId,
		text: req.body.review,
		receipt: req.file ? req.file.path : "",
	};

	try {
		await pool.query(
			"INSERT INTO pendingreviews (userId,placeId,text,receipt,timestamp) VALUES(?,?,?,?, NOW())",
			[review.userId, review.placeId, review.text, review.receipt]
		);
	} catch (e) {
		console.error(e);
		res.status(500).send(e);
	}
	res.contentType("application/json");

	res.status(201).json({ message: "review-added" });
});

app.get(
	"/reviews/pending",
	cors(corsOptions),
	validJWTNeeded,
	async (req, res) => {
		res.contentType("application/json");

		try {
			const pendingreviews = await DBHelpers.getAllPendingReviews(pool);
			const placeReviews = await Promise.all(
				pendingreviews.map(async (pendingReview) => {
					const { id, placeId, userId, text, receipt, timestamp } =
						pendingReview;
					const placeDetails = await getPlaceDetails(placeId);
					const reviewer = await DBHelpers.getUserById(pool, userId);

					return {
						...placeDetails,
						pendingReviewId: id,
						pendingReviewText: text,
						pendingReviewDate: timestamp,
						hasReceipt: Boolean(receipt),
						reviewer: reviewer[0],
					};
				})
			);
			res.status(201).json(placeReviews);
		} catch (e) {
			console.error(e);
			res.status(500).send(e);
		}
	}
);

app.post("/reviews", cors(corsOptions), validJWTNeeded, async (req, res) => {
	const pendingReviewId = req.body.id;
	const operation = req.body.operation;

	const [review] = await DBHelpers.getPendingReviewById(pool, pendingReviewId);

	try {
		if (operation === "accept") {
			await pool.query(
				"INSERT INTO reviews (userId,placeId,text,receipt,timestamp) VALUES(?,?,?,?, NOW())",
				[review.userId, review.placeId, review.text, review.receipt]
			);
			await pool.query("DELETE FROM pendingreviews WHERE id = ?", [
				pendingReviewId,
			]);
		} else if (operation === "decline") {
			await pool.query("DELETE FROM pendingreviews WHERE id = ?", [
				pendingReviewId,
			]);
		}
	} catch (e) {
		console.error(e);
		res.status(500).send(e);
	}
	res.contentType("application/json");

	res.status(201).json({ message: "Operation completed" });
});

app.post(
	"/reviews/report",
	cors(corsOptions),
	validJWTNeeded,
	async (req, res) => {
		const email = req.jwt.email;

		const users = await DBHelpers.getAllUsers(pool);
		const user = users.find((dbUser) => dbUser.email === email);

		const reportedReview = {
			reviewId: req.body.id,
			reason: req.body.reason,
		};

		try {
			await pool.query(
				"INSERT INTO reportedreviews (userId,reviewId,reason) VALUES(?,?,?)",
				[user.id, reportedReview.reviewId, reportedReview.reason]
			);
		} catch (e) {
			console.error(e);
			res.status(500).send(e);
		}
		res.contentType("application/json");

		res.status(201).json({ message: "reported-review-submitted" });
	}
);

app.post("/blacklist", cors(corsOptions), async (req, res) => {
	const reportedReview = {
		userId: req.body.userId,
		reason: req.body.reason,
	};

	try {
		await pool.query("INSERT INTO blacklist SET ?", {
			userId: reportedReview.userId,
			reason: reportedReview.reason,
		});
	} catch (e) {
		console.error(e);
		res.status(500).send(e);
	}
	res.contentType("application/json");

	res.status(201).json({ message: "reported-review-added" });
});

app.get("/receipt/download", validJWTNeeded, async (req, res) => {
	const pendingReviewId = parseInt(req.query.review);

	const [{ receipt }] = await DBHelpers.getPendingReviewById(
		pool,
		pendingReviewId
	);

	const file = `${receipt}`;
	res.status(200).download(file, (error) => {
		if (error) {
			console.error(error);
			res.status(500).send({ message: "Failed to retrieve receipt!" });
		}
	});
});

app.get("/reviews/history", validJWTNeeded, async (req, res) => {
	const email = req.jwt.email;

	const users = await DBHelpers.getAllUsers(pool);
	const user = users.find((dbUser) => dbUser.email === email);

	const reviews = await DBHelpers.getReviewsByUserId(pool, user.id);
	const pendingReviews = await DBHelpers.getPendingReviewsByUserId(
		pool,
		user.id
	);

	const enhancedPendingReviews = pendingReviews.map((pendingReview) => ({
		...pendingReview,
		status: "pending",
	}));

	const allReviews = [...reviews, ...enhancedPendingReviews];

	const reviewHistoryWithLocation = await Promise.all(
		allReviews.map(async (review) => {
			const { id, placeId, userId, text, receipt, timestamp } = review;
			const placeDetails = await getPlaceDetails(placeId);

			return {
				...placeDetails,
				reviewText: text,
				reviewDate: timestamp,
			};
		})
	);

	res.status(200).send(reviewHistoryWithLocation);
});

app.get("/reviews/report", validJWTNeeded, async (req, res) => {
	const reportedReviews = await DBHelpers.getReportedReviews(pool);

	const enhancedReportedReviews = await Promise.all(
		reportedReviews.map(async (reportedReview) => {
			const { userId, reviewId, reason } = reportedReview;
			const [review] = await DBHelpers.getReviewByReviewId(pool, reviewId);
			const placeDetails = await getPlaceDetails(review.placeId);
			const [user] = await DBHelpers.getUserById(pool, userId);
			const [author] = await DBHelpers.getUserById(pool, review.userId);

			return {
				...placeDetails,
				reportedReview: review.text,
				reportedReviewReason: reason,
				reportedBy: user,
				reviewAuthor: author,
			};
		})
	);

	res.status(200).send(enhancedReportedReviews);
});

const port = process.env.PORT || 3001;

app.listen(port, () => console.log("Server started."));
