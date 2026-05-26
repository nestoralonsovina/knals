package dev.knals.core;

public record Cluster(
    String name,
    String server,
    String user,
    boolean connected
) {}
