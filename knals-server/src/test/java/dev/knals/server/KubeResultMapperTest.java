package dev.knals.server;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class KubeResultMapperTest {

    @Test
    void successReturns200WithValue() {
        var result = new KubeResult.Success<>("hello");
        var response = KubeResultMapper.toResponse(result);
        assertEquals(200, response.getStatus());
        assertEquals("hello", response.getEntity());
    }

    @Test
    void forbiddenReturns403() {
        var response = KubeResultMapper.toResponse(new KubeResult.Forbidden<>("denied"));
        assertEquals(403, response.getStatus());
        assertErrorBody(response, "forbidden", "denied");
    }

    @Test
    void notFoundReturns404() {
        var response = KubeResultMapper.toResponse(new KubeResult.NotFound<>("pods/x"));
        assertEquals(404, response.getStatus());
        assertErrorBody(response, "not_found", "pods/x");
    }

    @Test
    void unreachableReturns502() {
        var response = KubeResultMapper.toResponse(new KubeResult.Unreachable<>("timeout"));
        assertEquals(502, response.getStatus());
        assertErrorBody(response, "unreachable", "timeout");
    }

    @Test
    void contextNotFoundReturns404() {
        var response = KubeResultMapper.toResponse(new KubeResult.ContextNotFound<>("bad-ctx"));
        assertEquals(404, response.getStatus());
        assertErrorBody(response, "context_not_found", "context not found: bad-ctx");
    }

    @Test
    void fallbackOverloadReturnsFallbackOnForbidden() {
        var response = KubeResultMapper.toResponse(new KubeResult.Forbidden<>("denied"), List.of());
        assertEquals(200, response.getStatus());
        assertEquals(List.of(), response.getEntity());
    }

    @Test
    void fallbackOverloadReturnsFallbackOnNotFound() {
        var response = KubeResultMapper.toResponse(new KubeResult.NotFound<>("gone"), List.of());
        assertEquals(200, response.getStatus());
        assertEquals(List.of(), response.getEntity());
    }

    @Test
    void fallbackOverloadReturnsFallbackOnContextNotFound() {
        var response = KubeResultMapper.toResponse(new KubeResult.ContextNotFound<>("x"), List.of());
        assertEquals(200, response.getStatus());
        assertEquals(List.of(), response.getEntity());
    }

    @Test
    void fallbackOverloadStillReturns502OnUnreachable() {
        var response = KubeResultMapper.toResponse(new KubeResult.Unreachable<>("down"), List.of());
        assertEquals(502, response.getStatus());
        assertErrorBody(response, "unreachable", "down");
    }

    @Test
    void fallbackOverloadReturnsSuccessValue() {
        var response = KubeResultMapper.toResponse(new KubeResult.Success<>("data"), List.of());
        assertEquals(200, response.getStatus());
        assertEquals("data", response.getEntity());
    }

    private void assertErrorBody(Response response, String expectedType, String expectedError) {
        var body = (KubeResultMapper.ErrorBody) response.getEntity();
        assertEquals(expectedType, body.type());
        assertEquals(expectedError, body.error());
    }
}
