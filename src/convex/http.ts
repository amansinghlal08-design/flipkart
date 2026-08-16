import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { registerApiRoutes, registerV2ApiRoutes } from "./apiGateway";

const http = httpRouter();

auth.addHttpRoutes(http);
registerApiRoutes(http);
registerV2ApiRoutes(http);

export default http;
