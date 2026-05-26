package dev.knals.core;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ClusterTest {

    @Test
    void constructsWithAllFields() {
        var cluster = new Cluster("prod", "https://k8s.example.com:6443", "admin", true);

        assertEquals("prod", cluster.name());
        assertEquals("https://k8s.example.com:6443", cluster.server());
        assertEquals("admin", cluster.user());
        assertTrue(cluster.connected());
    }

    @Test
    void disconnectedCluster() {
        var cluster = new Cluster("staging", "https://staging.internal:6443", "dev-user", false);

        assertFalse(cluster.connected());
    }

    @Test
    void recordEquality() {
        var a = new Cluster("test", "https://localhost:6443", "user", true);
        var b = new Cluster("test", "https://localhost:6443", "user", true);

        assertEquals(a, b);
    }
}
