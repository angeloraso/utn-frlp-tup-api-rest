const express = require("express");
const crypto = require("crypto");
const ERRORS = require("./errors");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
require("dotenv").config();
const app = express();
const PORT = 3000;
const { db, auth } = require("./firebase");

app.use(express.json());

app.use(
    cors({
        origin: "http://localhost:4200",
    }),
);

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "UTN FRLP TUP - Users API",
            version: "1.0.0",
            description: "A simple API for managing users",
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
            },
        ],
    },
    apis: ["./server.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * components:
 *   schemas:
 *     UserName:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           example: "Mr"
 *         first:
 *           type: string
 *           example: "John"
 *         last:
 *           type: string
 *           example: "Doe"
 *
 *     UserLogin:
 *       type: object
 *       properties:
 *         uuid:
 *           type: string
 *           format: uuid
 *           example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *
 *     User:
 *       type: object
 *       properties:
 *         gender:
 *           type: string
 *           nullable: true
 *           example: "male"
 *         name:
 *           $ref: '#/components/schemas/UserName'
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@example.com"
 *         login:
 *           $ref: '#/components/schemas/UserLogin'
 *
 *     UserInput:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *       properties:
 *         firstName:
 *           type: string
 *           example: "John"
 *         lastName:
 *           type: string
 *           example: "Doe"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@example.com"
 *
 *     UserPatchInput:
 *       type: object
 *       properties:
 *         firstName:
 *           type: string
 *           example: "John"
 *         lastName:
 *           type: string
 *           example: "Doe"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@example.com"
 *
 *     Error:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           example: "USER_NOT_FOUND"
 *         message:
 *           type: string
 *           example: "The requested user does not exist."
 *
 *   parameters:
 *     UserId:
 *       in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *       description: The user's UUID
 *       example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   responses:
 *     UserNotFound:
 *       description: User not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             code: "USER_NOT_FOUND"
 *             message: "The requested user does not exist."
 *     InvalidUserData:
 *       description: Missing or invalid fields in the request body
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             code: "INVALID_USER_DATA"
 *             message: "firstName, lastName and email are required."
 */

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Token required",
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = await auth.verifyIdToken(token);

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message: error.message,
        });
    }
}

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Get the authenticated user profile
 *     description: Returns the profile information of the currently authenticated user from the Firebase token.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: string
 *                   example: "abc123"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "john.doe@example.com"
 *                 name:
 *                   type: string
 *                   example: "John Doe"
 *       401:
 *         description: Unauthorized
 */
app.get("/me", authenticate, async (req, res) => {
    res.status(200).json({
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name,
    });
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Retrieve all users
 *     description: Returns the full list of users currently stored in memory. On server start, this list is populated with 50 random users from the randomuser.me API.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
app.get("/users", authenticate, async (req, res) => {
    const snapshot = await db.collection("users").get();

    const users = snapshot.docs.map((doc) => ({
        login: {
            uuid: doc.id,
        },
        ...doc.data(),
    }));

    res.status(200).json(users);
});

/**
 * @swagger
 * /users:
 *   options:
 *     summary: Allowed methods for /users
 *     description: Returns the HTTP methods supported by the /users endpoint via the Allow header.
 *     tags:
 *       - Users
 *     responses:
 *       204:
 *         description: No content. Allowed methods are listed in the Allow header.
 *         headers:
 *           Allow:
 *             schema:
 *               type: string
 *               example: "GET, POST, PUT, PATCH, DELETE"
 */
app.options("/users", authenticate, (req, res) => {
    res.set("Allow", "GET, POST, PUT, PATCH, DELETE");
    res.sendStatus(204);
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     description: Retrieves a single user identified by their UUID.
 *     tags:
 *       - Users
 *     parameters:
 *       - $ref: '#/components/parameters/UserId'
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/UserNotFound'
 */
app.get("/users/:id", authenticate, async (req, res) => {
    const doc = await db.collection("users").doc(req.params.id).get();

    if (!doc.exists) {
        return sendError(res, 404, ERRORS.USER_NOT_FOUND);
    }

    res.status(200).json({
        login: {
            uuid: doc.id,
        },
        ...doc.data(),
    });
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     description: Permanently removes a user from the list by their UUID.
 *     tags:
 *       - Users
 *     parameters:
 *       - $ref: '#/components/parameters/UserId'
 *     responses:
 *       204:
 *         description: User successfully deleted. No content returned.
 *       404:
 *         $ref: '#/components/responses/UserNotFound'
 */
app.delete("/users/:id", authenticate, async (req, res) => {
    await db.collection("users").doc(req.params.id).delete();

    res.status(204).send();
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     description: Creates a new user with the provided firstName, lastName, and email. A UUID is automatically generated for the new user.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201:
 *         description: User successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/InvalidUserData'
 */
app.post("/users", authenticate, async (req, res) => {
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
        return sendError(res, 400, ERRORS.INVALID_USER_DATA);
    }

    try {
        const uuid = crypto.randomUUID();
        const user = {
            id: uuid,
            gender: null,
            name: {
                title: "",
                first: firstName,
                last: lastName,
            },
            email,
        };

        await db.collection("users").doc(uuid).set(user);

        res.status(201).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Internal server error",
        });
    }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Fully replace a user
 *     description: Replaces the firstName, lastName, and email of an existing user. All three fields are required. Other fields (gender, login) remain unchanged.
 *     tags:
 *       - Users
 *     parameters:
 *       - $ref: '#/components/parameters/UserId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       200:
 *         description: User successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/InvalidUserData'
 *       404:
 *         $ref: '#/components/responses/UserNotFound'
 */
app.put("/users/:id", authenticate, async (req, res) => {
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
        return sendError(res, 400, ERRORS.INVALID_USER_DATA);
    }

    try {
        const docRef = db.collection("users").doc(req.params.id);

        const snapshot = await docRef.get();

        if (!snapshot.exists) {
            return sendError(res, 404, ERRORS.USER_NOT_FOUND);
        }

        const updatedUser = {
            id: snapshot.data().id,
            gender: snapshot.data().gender,
            name: {
                title: "",
                first: firstName,
                last: lastName,
            },
            email,
        };

        await docRef.set(updatedUser);

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Internal server error",
        });
    }
});

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Partially update a user
 *     description: Updates one or more fields (firstName, lastName, email) of an existing user. Only the fields provided in the request body will be modified.
 *     tags:
 *       - Users
 *     parameters:
 *       - $ref: '#/components/parameters/UserId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserPatchInput'
 *     responses:
 *       200:
 *         description: User successfully patched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/UserNotFound'
 */
app.patch("/users/:id", authenticate, async (req, res) => {
    try {
        const docRef = db.collection("users").doc(req.params.id);

        const snapshot = await docRef.get();

        if (!snapshot.exists) {
            return sendError(res, 404, ERRORS.USER_NOT_FOUND);
        }

        const currentUser = snapshot.data();

        const { firstName, lastName, email } = req.body;

        const updatedFields = {};

        if (firstName) {
            updatedFields.name = {
                ...currentUser.name,
                first: firstName,
            };
        }

        if (lastName) {
            updatedFields.name = updatedFields.name
                ? {
                    ...updatedFields.name,
                    last: lastName,
                }
                : {
                    ...currentUser.name,
                    last: lastName,
                };
        }

        if (email) {
            updatedFields.email = email;
        }

        await docRef.update(updatedFields);

        const updatedSnapshot = await docRef.get();

        res.status(200).json(updatedSnapshot.data());
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Internal server error",
        });
    }
});

/**
 * @swagger
 * /users/{id}:
 *   head:
 *     summary: Check if a user exists
 *     description: Returns 200 if a user with the given UUID exists, or 404 if not. No response body is returned.
 *     tags:
 *       - Users
 *     parameters:
 *       - $ref: '#/components/parameters/UserId'
 *     responses:
 *       200:
 *         description: User exists
 *       404:
 *         description: User not found
 */
app.head("/users/:id", authenticate, async (req, res) => {
    try {
        const snapshot = await db.collection("users").doc(req.params.id).get();

        if (!snapshot.exists) {
            return res.sendStatus(404);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

function sendError(res, httpCode, error) {
    return res.status(httpCode).json({
        code: error.code,
        message: error.message,
    });
}

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
        const snapshot = await db.collection("users").limit(1).get();

        if (!snapshot.empty) {
            console.log("Users collection already contains data");
            return;
        }

        console.log("Users collection is empty. Loading 50 users...");

        const response = await fetch("https://randomuser.me/api/?results=50");

        if (!response.ok) {
            throw new Error(`Random User API returned ${response.status}`);
        }

        const data = await response.json();
        const batch = db.batch();
        data.results.forEach((user) => {
            const docRef = db.collection("users").doc(user.login.uuid);
            batch.set(docRef, {
                id: user.login.uuid,
                gender: user.gender,
                name: {
                    title: user.name.title,
                    first: user.name.first,
                    last: user.name.last,
                },
                email: user.email,
            });
        });
        await batch.commit();
        console.log(`${data.results.length} users inserted`);
    } catch (error) {
        console.error("Error loading initial users:", error);
    }
});
