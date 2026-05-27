package dev.knals.server;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(LogEndpointTest.TestConfig.class)
class LogEndpointTest {

    public static class TestConfig implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "knals.config.dir", System.getProperty("java.io.tmpdir") + "/knals-test-logs-" + System.nanoTime()
            );
        }
    }

    @BeforeEach
    void setUp() {
        MockKubernetesService.reset();
    }

    @Test
    void snapshotReturnsLogOutput() {
        MockKubernetesService.stubLogs("test-ctx", "team-api", "api-pod-1",
                "2024-01-15T10:30:01Z Starting server\n2024-01-15T10:30:02Z Ready\n");

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/pods/api-pod-1/logs")
                .then()
                .statusCode(200)
                .contentType("text/plain")
                .body(containsString("Starting server"))
                .body(containsString("Ready"));
    }

    @Test
    void snapshotReturns404ForMissingPod() {
        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/pods/nonexistent/logs")
                .then()
                .statusCode(404);
    }

    @Test
    void snapshotReturns403WhenForbidden() {
        MockKubernetesService.stubLogsForbidden("test-ctx", "team-api", "restricted-pod");

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/pods/restricted-pod/logs")
                .then()
                .statusCode(403);
    }

    @Test
    void followReturnsStreamedOutput() {
        MockKubernetesService.stubLogs("test-ctx", "team-api", "api-pod-1",
                "line1\nline2\nline3\n");

        given()
                .queryParam("follow", true)
                .when().get("/clusters/test-ctx/namespaces/team-api/pods/api-pod-1/logs")
                .then()
                .statusCode(200)
                .contentType("text/plain")
                .body(containsString("line1"))
                .body(containsString("line3"));
    }

    @Test
    void followReturns404ForMissingPod() {
        given()
                .queryParam("follow", true)
                .when().get("/clusters/test-ctx/namespaces/team-api/pods/nonexistent/logs")
                .then()
                .statusCode(404);
    }

    @Test
    void returns404ForContextNotFound() {
        MockKubernetesService.stubContextNotFound("bad-ctx");

        given()
                .when().get("/clusters/bad-ctx/namespaces/team-api/pods/some-pod/logs")
                .then()
                .statusCode(404)
                .body("type", equalTo("context_not_found"));
    }
}
