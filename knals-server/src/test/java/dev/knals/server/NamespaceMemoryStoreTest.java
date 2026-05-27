package dev.knals.server;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class NamespaceMemoryStoreTest {

    @TempDir
    Path tempDir;

    NamespaceMemoryStore store;

    @BeforeEach
    void setUp() {
        store = new NamespaceMemoryStore(tempDir.toString());
    }

    @Test
    void returnsEmptyListForUnknownCluster() {
        List<String> result = store.list("unknown-ctx");
        assertTrue(result.isEmpty());
    }

    @Test
    void addsAndListsNamespace() {
        store.add("my-cluster", "team-api");
        List<String> result = store.list("my-cluster");
        assertEquals(List.of("team-api"), result);
    }

    @Test
    void addIsIdempotent() {
        store.add("my-cluster", "team-api");
        store.add("my-cluster", "team-api");
        List<String> result = store.list("my-cluster");
        assertEquals(List.of("team-api"), result);
    }

    @Test
    void addsMultipleNamespacesToSameCluster() {
        store.add("my-cluster", "team-api");
        store.add("my-cluster", "team-billing");
        List<String> result = store.list("my-cluster");
        assertEquals(2, result.size());
        assertTrue(result.contains("team-api"));
        assertTrue(result.contains("team-billing"));
    }

    @Test
    void isolatesClusterNamespaces() {
        store.add("cluster-a", "ns-1");
        store.add("cluster-b", "ns-2");
        assertEquals(List.of("ns-1"), store.list("cluster-a"));
        assertEquals(List.of("ns-2"), store.list("cluster-b"));
    }

    @Test
    void removesNamespace() {
        store.add("my-cluster", "team-api");
        store.add("my-cluster", "team-billing");
        boolean removed = store.remove("my-cluster", "team-api");
        assertTrue(removed);
        assertEquals(List.of("team-billing"), store.list("my-cluster"));
    }

    @Test
    void removeReturnsFalseWhenNotFound() {
        boolean removed = store.remove("my-cluster", "nonexistent");
        assertFalse(removed);
    }

    @Test
    void persistsAcrossInstances() {
        store.add("my-cluster", "team-api");
        store.add("my-cluster", "team-billing");

        var store2 = new NamespaceMemoryStore(tempDir.toString());
        List<String> result = store2.list("my-cluster");
        assertEquals(2, result.size());
        assertTrue(result.contains("team-api"));
        assertTrue(result.contains("team-billing"));
    }

    @Test
    void createsConfigDirectoryIfMissing() {
        Path nested = tempDir.resolve("sub/dir");
        var nestedStore = new NamespaceMemoryStore(nested.toString());
        nestedStore.add("ctx", "ns");
        assertEquals(List.of("ns"), nestedStore.list("ctx"));
    }
}
