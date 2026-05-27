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
                    .entity(new KubeResultMapper.ErrorBody("bad_request", "Unknown resource type: " + type))
                    .build();
        }
        return KubeResultMapper.toResponse(kubernetesService.listResources(ctx, ns, type));
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
                    .entity(new KubeResultMapper.ErrorBody("bad_request", "Unknown resource type: " + type))
                    .build();
        }
        return KubeResultMapper.toResponse(kubernetesService.getResource(ctx, ns, type, name));
    }
}
