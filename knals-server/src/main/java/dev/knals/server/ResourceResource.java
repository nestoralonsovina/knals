package dev.knals.server;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/clusters/{ctx}/namespaces/{ns}/resources")
@Produces(MediaType.APPLICATION_JSON)
public class ResourceResource {

    @Inject
    KubernetesService kubernetesService;

    @GET
    @Path("/{type}")
    public Response list(
            @PathParam("ctx") String ctx,
            @PathParam("ns") String ns,
            @PathParam("type") String type) {
        if (!KubernetesService.isValidResourceType(type)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"Unknown resource type: " + type + "\"}")
                    .build();
        }
        return toResponse(kubernetesService.listResources(ctx, ns, type));
    }

    @GET
    @Path("/{type}/{name}")
    public Response get(
            @PathParam("ctx") String ctx,
            @PathParam("ns") String ns,
            @PathParam("type") String type,
            @PathParam("name") String name) {
        if (!KubernetesService.isValidResourceType(type)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"Unknown resource type: " + type + "\"}")
                    .build();
        }
        return toResponse(kubernetesService.getResource(ctx, ns, type, name));
    }

    private <T> Response toResponse(KubeResult<T> result) {
        return switch (result) {
            case KubeResult.Success<T> s -> Response.ok(s.value()).build();
            case KubeResult.Forbidden<?> f ->
                Response.status(Response.Status.FORBIDDEN)
                        .entity("{\"error\": \"" + f.message() + "\"}")
                        .build();
            case KubeResult.NotFound<?> n ->
                Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"" + n.what() + "\"}")
                        .build();
            case KubeResult.Unreachable<?> u ->
                Response.status(Response.Status.BAD_GATEWAY)
                        .entity("{\"error\": \"" + u.reason() + "\"}")
                        .build();
            case KubeResult.ContextNotFound<?> c ->
                Response.status(Response.Status.NOT_FOUND)
                        .entity("{\"error\": \"context not found: " + c.context() + "\"}")
                        .build();
        };
    }
}
