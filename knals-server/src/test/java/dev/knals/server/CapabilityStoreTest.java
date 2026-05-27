package dev.knals.server;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CapabilityStoreTest {

    @TempDir
    Path tempDir;

    CapabilityStore store;

    @BeforeEach
    void setUp() {
        store = new CapabilityStore(tempDir.toString());
    }

    @Test
    void returnsNullForUnknownSnapshot() {
        assertNull(store.get("cluster", "ns"));
    }

    @Test
    void savesAndLoadsSnapshot() {
        var snapshot = Map.of(
                "pods", List.of("get", "list", "watch"),
                "services", List.of("get", "list")
        );
        store.put("my-cluster", "team-api", snapshot);

        var loaded = store.get("my-cluster", "team-api");
        assertNotNull(loaded);
        assertEquals(List.of("get", "list", "watch"), loaded.get("pods"));
        assertEquals(List.of("get", "list"), loaded.get("services"));
    }

    @Test
    void overwritesOnReProbe() {
        store.put("cluster", "ns", Map.of("pods", List.of("get")));
        store.put("cluster", "ns", Map.of("pods", List.of("get", "list"), "secrets", List.of("get")));

        var loaded = store.get("cluster", "ns");
        assertEquals(List.of("get", "list"), loaded.get("pods"));
        assertEquals(List.of("get"), loaded.get("secrets"));
    }

    @Test
    void isolatesClusterNamespacePairs() {
        store.put("cluster-a", "ns-1", Map.of("pods", List.of("get")));
        store.put("cluster-b", "ns-2", Map.of("services", List.of("list")));

        assertNotNull(store.get("cluster-a", "ns-1"));
        assertNotNull(store.get("cluster-b", "ns-2"));
        assertNull(store.get("cluster-a", "ns-2"));
    }

    @Test
    void persistsAcrossInstances() {
        store.put("cluster", "ns", Map.of("pods", List.of("get", "list")));

        var store2 = new CapabilityStore(tempDir.toString());
        var loaded = store2.get("cluster", "ns");
        assertNotNull(loaded);
        assertEquals(List.of("get", "list"), loaded.get("pods"));
    }

    @Test
    void createsConfigDirectoryIfMissing() {
        Path nested = tempDir.resolve("sub/dir");
        var nestedStore = new CapabilityStore(nested.toString());
        nestedStore.put("ctx", "ns", Map.of("pods", List.of("list")));
        assertEquals(List.of("list"), nestedStore.get("ctx", "ns").get("pods"));
    }
}
