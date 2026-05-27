package dev.knals.server;

import jakarta.enterprise.context.ApplicationScoped;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@ApplicationScoped
public class KubectlService {

    private static final int TIMEOUT_SECONDS = 10;

    public KubectlResult describe(String context, String namespace, String type, String name) {
        try {
            var process = new ProcessBuilder(
                    "kubectl", "describe", type + "/" + name,
                    "-n", namespace, "--context", context
            ).redirectErrorStream(false).start();

            boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new KubectlResult.Timeout();
            }

            var stdout = new String(process.getInputStream().readAllBytes());
            var stderr = new String(process.getErrorStream().readAllBytes());

            if (process.exitValue() == 0) {
                return new KubectlResult.Success(stdout);
            }

            var lower = stderr.toLowerCase();
            if (lower.contains("not found") || lower.contains("notfound")) {
                return new KubectlResult.NotFound(stderr.trim());
            }
            if (lower.contains("forbidden") || lower.contains("unauthorized")) {
                return new KubectlResult.Forbidden(stderr.trim());
            }
            return new KubectlResult.Failed(stderr.trim());
        } catch (IOException e) {
            if (e.getMessage() != null && e.getMessage().contains("No such file")) {
                return new KubectlResult.Unavailable();
            }
            return new KubectlResult.Failed(e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new KubectlResult.Failed("interrupted");
        }
    }

    public sealed interface KubectlResult {
        record Success(String output) implements KubectlResult {}
        record NotFound(String message) implements KubectlResult {}
        record Forbidden(String message) implements KubectlResult {}
        record Unavailable() implements KubectlResult {}
        record Timeout() implements KubectlResult {}
        record Failed(String message) implements KubectlResult {}
    }
}
