package dev.knals.server;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;

@Path("/clusters/{ctx}/namespaces/{ns}/pods/{name}/logs")
public class LogResource {

    @Inject
    KubernetesService kubernetesService;

    @GET
    public Response getLogs(
            @PathParam("ctx") String ctx,
            @PathParam("ns") String ns,
            @PathParam("name") String name,
            @QueryParam("follow") @DefaultValue("false") boolean follow,
            @QueryParam("tailLines") @DefaultValue("100") int tailLines,
            @QueryParam("container") String container) {

        if (follow) {
            var result = kubernetesService.openLogStream(ctx, ns, name, container, tailLines);
            if (result instanceof KubeResult.Success<KubernetesService.PodLogStream> s) {
                StreamingOutput stream = output -> {
                    try (var logStream = s.value()) {
                        logStream.input().transferTo(output);
                    } catch (Exception ignored) {}
                };
                return Response.ok(stream).type(MediaType.TEXT_PLAIN).build();
            }
            return KubeResultMapper.toResponse(result);
        }

        var result = kubernetesService.getLogSnapshot(ctx, ns, name, container, tailLines);
        if (result instanceof KubeResult.Success<String> s) {
            return Response.ok(s.value()).type(MediaType.TEXT_PLAIN).build();
        }
        return KubeResultMapper.toResponse(result);
    }
}
