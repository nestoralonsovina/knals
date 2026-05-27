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
@TestProfile(ResourceEndpointTest.TestConfig.class)
class ResourceEndpointTest {

    public static class TestConfig implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "knals.config.dir", System.getProperty("java.io.tmpdir") + "/knals-test-resources-" + System.nanoTime()
            );
        }
    }

    @BeforeEach
    void setUp() {
        MockKubernetesService.reset();
    }

    @Test
    void listResourcesReturnsTableShape() {
        MockKubernetesService.stubListResources("test-ctx", "team-api", "pods",
                new ResourceTable("pods",
                        List.of("NAME", "READY", "STATUS", "RESTARTS", "AGE"),
                        List.of(new ResourceTable.ResourceRow(
                                "api-pod-1", "team-api",
                                List.of("api-pod-1", "1/1", "Running", "0", "3d2h"),
                                "2026-05-20T10:00:00Z"
                        ))
                ));

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods")
                .then()
                .statusCode(200)
                .body("kind", equalTo("pods"))
                .body("columns", hasSize(5))
                .body("columns[0]", equalTo("NAME"))
                .body("items", hasSize(1))
                .body("items[0].name", equalTo("api-pod-1"))
                .body("items[0].cells[2]", equalTo("Running"));
    }

    @Test
    void listResourcesReturnsEmptyOnForbidden() {
        MockKubernetesService.stubListResources("test-ctx", "team-api", "pods",
                new ResourceTable("pods", List.of(), List.of()));

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods")
                .then()
                .statusCode(200)
                .body("items", hasSize(0));
    }

    @Test
    void listResourcesRejects_unknownType() {
        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/unknown")
                .then()
                .statusCode(400);
    }

    @Test
    void listResourcesWorksForDeployments() {
        MockKubernetesService.stubListResources("test-ctx", "team-api", "deployments",
                new ResourceTable("deployments",
                        List.of("NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"),
                        List.of(new ResourceTable.ResourceRow(
                                "api-deploy", "team-api",
                                List.of("api-deploy", "3/3", "3", "3", "5d"),
                                "2026-05-22T10:00:00Z"
                        ))
                ));

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/deployments")
                .then()
                .statusCode(200)
                .body("kind", equalTo("deployments"))
                .body("items[0].name", equalTo("api-deploy"));
    }

    @Test
    void getResourceReturnsDetail() {
        MockKubernetesService.stubGetResource("test-ctx", "team-api", "pods", "api-pod-1",
                "{\"apiVersion\":\"v1\",\"kind\":\"Pod\",\"metadata\":{\"name\":\"api-pod-1\"}}");

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods/api-pod-1")
                .then()
                .statusCode(200)
                .body("kind", equalTo("Pod"))
                .body("metadata.name", equalTo("api-pod-1"));
    }

    @Test
    void getResourceReturns404WhenNotFound() {
        MockKubernetesService.stubGetResource("test-ctx", "team-api", "pods", "nonexistent", null);

        given()
                .when().get("/clusters/test-ctx/namespaces/team-api/resources/pods/nonexistent")
                .then()
                .statusCode(404);
    }
}
