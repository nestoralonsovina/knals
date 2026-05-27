package dev.knals.server;

public sealed interface KubeResult<T> {
    record Success<T>(T value) implements KubeResult<T> {}
    record Forbidden<T>(String message) implements KubeResult<T> {}
    record NotFound<T>(String what) implements KubeResult<T> {}
    record Unreachable<T>(String reason) implements KubeResult<T> {}
    record ContextNotFound<T>(String context) implements KubeResult<T> {}
}
