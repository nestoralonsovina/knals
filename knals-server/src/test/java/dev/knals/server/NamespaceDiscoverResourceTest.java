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
@TestProfile(NamespaceDiscoverResourceTest.TestConfig.class)
class NamespaceDiscoverResourceTest {

    public static class TestConfig implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "knals.config.dir", System.getProperty("java.io.tmpdir") + "/knals-test-discover-" + System.nanoTime()
            );
        }
    }

    @BeforeEach
    void setUp() {
        MockKubernetesService.reset();
    }

    @Test
    void discoverReturnsNewlyFoundNamespaces() {
        MockKubernetesService.stubListNamespaces("test-ctx",
                List.of("default", "kube-system", "team-api"));

        given()
                .when().post("/clusters/test-ctx/namespaces/discover")
                .then()
                .statusCode(200)
                .body("$", hasSize(3))
                .body("$", hasItems("default", "kube-system", "team-api"));
    }

    @Test
    void discoverMergesWithExistingMemory() {
        given()
                .contentType("application/json")
                .body("{\"name\": \"manual-ns\"}")
                .when().post("/clusters/merge-ctx/namespaces")
                .then()
                .statusCode(201);

        MockKubernetesService.stubListNamespaces("merge-ctx",
                List.of("discovered-ns"));

        given()
                .when().post("/clusters/merge-ctx/namespaces/discover")
                .then()
                .statusCode(200)
                .body("$", hasSize(1))
                .body("$", hasItem("discovered-ns"));

        given()
                .when().get("/clusters/merge-ctx/namespaces")
                .then()
                .statusCode(200)
                .body("$", hasSize(2))
                .body("$", hasItems("manual-ns", "discovered-ns"));
    }

    @Test
    void discoverReturnsEmptyOnForbidden() {
        MockKubernetesService.stubListNamespaces("forbidden-ctx", List.of());

        given()
                .when().post("/clusters/forbidden-ctx/namespaces/discover")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    void discoverDoesNotRemoveExistingNamespaces() {
        given()
                .contentType("application/json")
                .body("{\"name\": \"ns-1\"}")
                .when().post("/clusters/keep-ctx/namespaces");
        given()
                .contentType("application/json")
                .body("{\"name\": \"ns-2\"}")
                .when().post("/clusters/keep-ctx/namespaces");

        MockKubernetesService.stubListNamespaces("keep-ctx", List.of("ns-1"));

        given()
                .when().post("/clusters/keep-ctx/namespaces/discover")
                .then()
                .statusCode(200);

        given()
                .when().get("/clusters/keep-ctx/namespaces")
                .then()
                .statusCode(200)
                .body("$", hasSize(2))
                .body("$", hasItems("ns-1", "ns-2"));
    }

    @Test
    void discoverIsIdempotent() {
        MockKubernetesService.stubListNamespaces("idem-ctx",
                List.of("ns-a", "ns-b"));

        given()
                .when().post("/clusters/idem-ctx/namespaces/discover")
                .then()
                .statusCode(200)
                .body("$", hasSize(2));

        given()
                .when().post("/clusters/idem-ctx/namespaces/discover")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }
}
