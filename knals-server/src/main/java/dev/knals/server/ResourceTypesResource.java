package dev.knals.server;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

@Path("/resources/types")
@Produces(MediaType.APPLICATION_JSON)
public class ResourceTypesResource {

    @GET
    public List<ResourceTypeInfo> list() {
        return ResourceTypeInfo.all();
    }
}
