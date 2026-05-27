package dev.knals.server;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestProfile(CapabilityEndpointTest.TestConfig.class)
class CapabilityEndpointTest {

    public static class TestConfig implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "knals.config.dir", System.getProperty("java.io.tmpdir") + "/knals-test-caps-" + System.nanoTime()
            );
        }
    }

    @BeforeEach
    void setUp() {
        MockKubernetesService.reset();
    }

    @Test
    void getReturns404WhenNoSnapshot() {
        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/capabilities")
                .then()
                .statusCode(404)
                .body("type", equalTo("not_found"));
    }

    @Test
    void refreshReturnsSnapshot() {
        MockKubernetesService.stubCapabilities("test-ctx", "team-api", Map.of(
                "pods", List.of("get", "list", "watch"),
                "services", List.of("get", "list")
        ));

        given()
                .when().post("/clusters/test-ctx/namespaces/team-api/capabilities/refresh")
                .then()
                .statusCode(200)
                .body("pods", hasItems("get", "list", "watch"))
                .body("services", hasItems("get", "list"));
    }

    @Test
    void getReturnsCachedSnapshotAfterRefresh() {
        MockKubernetesService.stubCapabilities("test-ctx", "team-api", Map.of(
                "pods", List.of("get", "list")
        ));

        given().when().post("/clusters/test-ctx/namespaces/team-api/capabilities/refresh")
                .then().statusCode(200);

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/capabilities")
                .then()
                .statusCode(200)
                .body("pods", hasItems("get", "list"));
    }

    @Test
    void refreshOverwritesPreviousSnapshot() {
        MockKubernetesService.stubCapabilities("test-ctx", "team-api", Map.of(
                "pods", List.of("get")
        ));
        given().when().post("/clusters/test-ctx/namespaces/team-api/capabilities/refresh")
                .then().statusCode(200);

        MockKubernetesService.stubCapabilities("test-ctx", "team-api", Map.of(
                "pods", List.of("get", "list"),
                "secrets", List.of("get")
        ));
        given().when().post("/clusters/test-ctx/namespaces/team-api/capabilities/refresh")
                .then().statusCode(200);

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/capabilities")
                .then()
                .statusCode(200)
                .body("pods", hasItems("get", "list"))
                .body("secrets", hasItems("get"));
    }

    @Test
    void refreshReturns404ForContextNotFound() {
        MockKubernetesService.stubContextNotFound("bad-ctx");

        given()
                .when().post("/clusters/bad-ctx/namespaces/team-api/capabilities/refresh")
                .then()
                .statusCode(404)
                .body("type", equalTo("context_not_found"));
    }
}
