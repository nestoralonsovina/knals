package dev.knals.server;

import jakarta.ws.rs.core.Response;

public class KubeResultMapper {

    public static <T> Response toResponse(KubeResult<T> result) {
        return switch (result) {
            case KubeResult.Success<T> s -> Response.ok(s.value()).build();
            case KubeResult.Forbidden<?> f -> errorResponse(403, "forbidden", f.message());
            case KubeResult.NotFound<?> n -> errorResponse(404, "not_found", n.what());
            case KubeResult.Unreachable<?> u -> errorResponse(502, "unreachable", u.reason());
            case KubeResult.ContextNotFound<?> c -> errorResponse(404, "context_not_found", "context not found: " + c.context());
        };
    }

    public static <T> Response toResponse(KubeResult<T> result, T fallbackOnForbidden) {
        return switch (result) {
            case KubeResult.Success<T> s -> Response.ok(s.value()).build();
            case KubeResult.Forbidden<?> f -> Response.ok(fallbackOnForbidden).build();
            case KubeResult.NotFound<?> n -> Response.ok(fallbackOnForbidden).build();
            case KubeResult.ContextNotFound<?> c -> Response.ok(fallbackOnForbidden).build();
            case KubeResult.Unreachable<?> u -> errorResponse(502, "unreachable", u.reason());
        };
    }

    private static Response errorResponse(int status, String type, String message) {
        return Response.status(status)
                .entity(new ErrorBody(type, message))
                .build();
    }

    public record ErrorBody(String type, String error) {}
}
