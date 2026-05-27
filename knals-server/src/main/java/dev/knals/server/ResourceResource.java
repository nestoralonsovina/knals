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

    @Inject
    KubectlService kubectlService;

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

    @GET
    @Path("/{type}/{name}/describe")
    public Response describe(
            @PathParam("ctx") String ctx,
            @PathParam("ns") String ns,
            @PathParam("type") String type,
            @PathParam("name") String name) {
        if (!KubernetesService.isValidResourceType(type)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new KubeResultMapper.ErrorBody("bad_request", "Unknown resource type: " + type))
                    .build();
        }
        var result = kubectlService.describe(ctx, ns, type, name);
        return switch (result) {
            case KubectlService.KubectlResult.Success s ->
                    Response.ok(s.output()).type(MediaType.TEXT_PLAIN).build();
            case KubectlService.KubectlResult.NotFound n ->
                    Response.status(404).entity(new KubeResultMapper.ErrorBody("not_found", n.message())).build();
            case KubectlService.KubectlResult.Forbidden f ->
                    Response.status(403).entity(new KubeResultMapper.ErrorBody("forbidden", f.message())).build();
            case KubectlService.KubectlResult.Unavailable u ->
                    Response.status(503).entity(new KubeResultMapper.ErrorBody("kubectl_unavailable",
                            "kubectl binary not found on PATH. Install kubectl to use the describe feature.")).build();
            case KubectlService.KubectlResult.Timeout t ->
                    Response.status(504).entity(new KubeResultMapper.ErrorBody("timeout", "kubectl describe timed out")).build();
            case KubectlService.KubectlResult.Failed f ->
                    Response.status(500).entity(new KubeResultMapper.ErrorBody("error", f.message())).build();
        };
    }
}
