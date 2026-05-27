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
@TestProfile(NamespaceResourceTest.TestConfig.class)
class NamespaceResourceTest {

    public static class TestConfig implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "knals.config.dir", System.getProperty("java.io.tmpdir") + "/knals-test-" + System.nanoTime()
            );
        }
    }

    @BeforeEach
    void cleanStore() {
        // Each test class gets a fresh temp dir via TestConfig
    }

    @Test
    void listReturnsEmptyArrayForNewCluster() {
        given()
                .when().get("/clusters/test-ctx/namespaces")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    void addAndListNamespace() {
        given()
                .contentType("application/json")
                .body("{\"name\": \"team-api\"}")
                .when().post("/clusters/test-ctx/namespaces")
                .then()
                .statusCode(201);

        given()
                .when().get("/clusters/test-ctx/namespaces")
                .then()
                .statusCode(200)
                .body("$", hasSize(1))
                .body("[0]", equalTo("team-api"));
    }

    @Test
    void addRejectsMissingName() {
        given()
                .contentType("application/json")
                .body("{}")
                .when().post("/clusters/test-ctx/namespaces")
                .then()
                .statusCode(400);
    }

    @Test
    void addRejectsBlankName() {
        given()
                .contentType("application/json")
                .body("{\"name\": \"\"}")
                .when().post("/clusters/test-ctx/namespaces")
                .then()
                .statusCode(400);
    }

    @Test
    void deleteRemovesNamespace() {
        given()
                .contentType("application/json")
                .body("{\"name\": \"team-api\"}")
                .when().post("/clusters/test-ctx/namespaces")
                .then()
                .statusCode(201);

        given()
                .when().delete("/clusters/test-ctx/namespaces/team-api")
                .then()
                .statusCode(204);

        given()
                .when().get("/clusters/test-ctx/namespaces")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    void deleteReturns404WhenNotFound() {
        given()
                .when().delete("/clusters/test-ctx/namespaces/nonexistent")
                .then()
                .statusCode(404);
    }
}
