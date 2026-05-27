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
@TestProfile(DescribeEndpointTest.TestConfig.class)
class DescribeEndpointTest {

    public static class TestConfig implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "knals.config.dir", System.getProperty("java.io.tmpdir") + "/knals-test-describe-" + System.nanoTime()
            );
        }
    }

    @BeforeEach
    void setUp() {
        MockKubernetesService.reset();
        MockKubectlService.reset();
    }

    @Test
    void describeReturnsKubectlOutput() {
        MockKubectlService.stubDescribe("test-ctx", "team-api", "pods", "api-pod-1",
                new KubectlService.KubectlResult.Success("Name:         api-pod-1\nNamespace:    team-api\nStatus:       Running\n"));

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods/api-pod-1/describe")
                .then()
                .statusCode(200)
                .contentType("text/plain")
                .body(containsString("Name:         api-pod-1"))
                .body(containsString("Status:       Running"));
    }

    @Test
    void describeReturns404ForNotFound() {
        MockKubectlService.stubDescribe("test-ctx", "team-api", "pods", "missing",
                new KubectlService.KubectlResult.NotFound("pods \"missing\" not found"));

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods/missing/describe")
                .then()
                .statusCode(404)
                .body("type", equalTo("not_found"));
    }

    @Test
    void describeReturns403ForForbidden() {
        MockKubectlService.stubDescribe("test-ctx", "team-api", "secrets", "my-secret",
                new KubectlService.KubectlResult.Forbidden("forbidden: User cannot get secrets"));

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/secrets/my-secret/describe")
                .then()
                .statusCode(403)
                .body("type", equalTo("forbidden"));
    }

    @Test
    void describeReturns503WhenKubectlUnavailable() {
        MockKubectlService.stubDescribe("test-ctx", "team-api", "pods", "pod-1",
                new KubectlService.KubectlResult.Unavailable());

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods/pod-1/describe")
                .then()
                .statusCode(503)
                .body("type", equalTo("kubectl_unavailable"));
    }

    @Test
    void describeReturns504OnTimeout() {
        MockKubectlService.stubDescribe("test-ctx", "team-api", "pods", "pod-1",
                new KubectlService.KubectlResult.Timeout());

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods/pod-1/describe")
                .then()
                .statusCode(504)
                .body("type", equalTo("timeout"));
    }

    @Test
    void describeRejectsBadResourceType() {
        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/unknown/pod-1/describe")
                .then()
                .statusCode(400)
                .body("type", equalTo("bad_request"));
    }
}
