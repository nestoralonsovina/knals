package dev.knals.server;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;

@Path("/clusters/{ctx}/namespaces/{ns}/capabilities")
@Produces(MediaType.APPLICATION_JSON)
public class CapabilityResource {

    @Inject
    CapabilityStore store;

    @Inject
    KubernetesService kubernetesService;

    @GET
    public Response get(@PathParam("ctx") String ctx, @PathParam("ns") String ns) {
        var snapshot = store.get(ctx, ns);
        if (snapshot == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new KubeResultMapper.ErrorBody("not_found", "No capability snapshot for " + ctx + ":" + ns))
                    .build();
        }
        return Response.ok(snapshot).build();
    }

    @POST
    @Path("/refresh")
    public Response refresh(@PathParam("ctx") String ctx, @PathParam("ns") String ns) {
        var result = kubernetesService.selfSubjectRulesReview(ctx, ns);
        if (result instanceof KubeResult.Success<Map<String, List<String>>> s) {
            store.put(ctx, ns, s.value());
            return Response.ok(s.value()).build();
        }
        return KubeResultMapper.toResponse(result);
    }
}
