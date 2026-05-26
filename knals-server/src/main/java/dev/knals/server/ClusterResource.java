package dev.knals.server;

import dev.knals.core.Cluster;
import io.fabric8.kubernetes.client.Config;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/clusters")
@Produces(MediaType.APPLICATION_JSON)
public class ClusterResource {

    @GET
    public List<Cluster> list() {
        var defaultConfig = Config.autoConfigure(null);
        var contexts = defaultConfig.getContexts();
        var currentCtx = defaultConfig.getCurrentContext();
        var currentCtxName = currentCtx != null ? currentCtx.getName() : "";

        return contexts.stream()
                .map(ctx -> {
                    var ctxConfig = Config.autoConfigure(ctx.getName());
                    return new Cluster(
                            ctx.getName(),
                            ctxConfig.getMasterUrl(),
                            ctx.getContext().getUser(),
                            ctx.getName().equals(currentCtxName));
                })
                .toList();
    }
}
