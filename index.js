import { ApolloServer } from "@apollo/server";
import { startServerAndCreateLambdaHandler, handlers } from "@as-integrations/aws-lambda";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

let isConnected = false; // Track connection status

// MongoDB connection function
const connectToDatabase = async () => {
  if (isConnected) {
    console.log("=> Using existing MongoDB connection");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    isConnected = true;
    console.log("=> Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw new Error("Could not connect to MongoDB");
  }
};

// Define Mongoose schema and model
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  imageUrl: String,
});

const Product = mongoose.model("Product", productSchema);

// Define GraphQL schema
const typeDefs = `#graphql
  type Product {
    id: ID!
    name: String!
    description: String!
    price: Float!
    imageUrl: String!
  }

  input ProductInput {
    name: String!
    description: String!
    price: Float!
    imageUrl: String!
  }

  type Query {
    product(id: ID!): Product
    products: [Product]
  }

  type Mutation {
    addProduct(input: ProductInput): Product
  }
`;

// Define resolvers
const resolvers = {
  Query: {
    // Resolver for fetching a single product by its ID
    product: async (_, { id }) => {
      console.log("enetered product by id resolver");
      await connectToDatabase(); // Ensure DB connection
      return await Product.findById(id);
    },
    // Resolver for fetching all products
    products: async () => {
      console.log("enetered products resolver");
      await connectToDatabase(); // Ensure DB connection
      const response = await Product.find();
      console.log(response, "responseeee");
      return await Product.find();
    },
  },

  Mutation: {
    // Resolver for adding a new product
    addProduct: async (_, { input }) => {
      await connectToDatabase(); // Ensure DB connection
      try {
        const product = new Product(input);
        return await product.save(); // Save the new product to the database
      } catch (error) {
        console.error("Error adding product:", error);
        throw new Error("Failed to add product");
      }
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

export const graphqlHandler = startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler()
);

// Query.json
// Body for creating product  - "{\"query\": \"mutation($input: ProductInput!) { addProduct(input: $input) { id name description price imageUrl } }\", \"variables\": {\"input\": {\"name\": \"New Product\", \"description\": \"This is a new product\", \"price\": 9.99, \"imageUrl\": \"https://example.com/new-product.jpg\"}}}"
// Body for Get product by id  - "{\"query\": \"query product($id: ID!) { product(id: $id) { id name description price imageUrl } }\", \"variables\": {\"id\": \"6688e0b293ec69eb5697425b\"}}"
// Body for Get All product - "{\"query\": \"{ products { id name description price imageUrl } }\"}"
