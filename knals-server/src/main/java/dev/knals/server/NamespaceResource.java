package dev.knals.server;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/clusters/{ctx}/namespaces")
@Produces(MediaType.APPLICATION_JSON)
public class NamespaceResource {

    @Inject
    NamespaceMemoryStore store;

    @GET
    public List<String> list(@PathParam("ctx") String ctx) {
        return store.list(ctx);
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response add(@PathParam("ctx") String ctx, AddNamespaceRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"name is required\"}")
                    .build();
        }
        store.add(ctx, request.name());
        return Response.status(Response.Status.CREATED).build();
    }

    @DELETE
    @Path("/{ns}")
    public Response remove(@PathParam("ctx") String ctx, @PathParam("ns") String ns) {
        boolean removed = store.remove(ctx, ns);
        if (!removed) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.noContent().build();
    }
}
