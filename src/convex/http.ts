import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { registerApiRoutes } from "./apiGateway";

const http = httpRouter();

auth.addHttpRoutes(http);
registerApiRoutes(http);

export default http;
