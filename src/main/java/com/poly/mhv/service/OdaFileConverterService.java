package com.poly.mhv.service;

import com.poly.mhv.exception.CustomException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class OdaFileConverterService {

    private final boolean enabled;
    private final String executablePath;
    private final String outputVersion;
    private final long timeoutSeconds;
    private final boolean auditEachFile;
    private final boolean recursive;
    private final boolean useXvfb;

    public OdaFileConverterService(
            @Value("${app.asset-map-import.oda.enabled:false}") boolean enabled,
            @Value("${app.asset-map-import.oda.executable-path:}") String executablePath,
            @Value("${app.asset-map-import.oda.output-version:ACAD2018}") String outputVersion,
            @Value("${app.asset-map-import.oda.timeout-seconds:120}") long timeoutSeconds,
            @Value("${app.asset-map-import.oda.audit:true}") boolean auditEachFile,
            @Value("${app.asset-map-import.oda.recursive:false}") boolean recursive,
            @Value("${app.asset-map-import.oda.use-xvfb:false}") boolean useXvfb
    ) {
        this.enabled = enabled;
        this.executablePath = StringUtils.hasText(executablePath) ? executablePath.trim() : "ODAFileConverter";
        this.outputVersion = StringUtils.hasText(outputVersion) ? outputVersion.trim().toUpperCase(Locale.ROOT) : "ACAD2018";
        this.timeoutSeconds = Math.max(timeoutSeconds, 30L);
        this.auditEachFile = auditEachFile;
        this.recursive = recursive;
        this.useXvfb = useXvfb;
    }

    public boolean isEnabledFor(String sourceFileType) {
        return enabled && "DWG".equalsIgnoreCase(sourceFileType);
    }

    public OdaConversionResult convertDwgToDxf(Path sourceFile, Path workspaceDir) {
        if (!isEnabledFor("DWG")) {
            throw new CustomException("ODA File Converter chua duoc bat.");
        }
        if (sourceFile == null || !Files.isRegularFile(sourceFile)) {
            throw new CustomException("Khong tim thay file DWG de convert.");
        }
        try {
            Files.createDirectories(workspaceDir);
            Path outputDir = workspaceDir.resolve("oda-output");
            Files.createDirectories(outputDir);
            String baseName = sourceFile.getFileName().toString();
            List<String> command = new ArrayList<>();
            if (useXvfb) {
                command.add("xvfb-run");
                command.add("-a");
            }
            command.add(executablePath);
            command.add(sourceFile.getParent().toAbsolutePath().toString());
            command.add(outputDir.toAbsolutePath().toString());
            command.add(outputVersion);
            command.add("DXF");
            command.add(recursive ? "1" : "0");
            command.add(auditEachFile ? "1" : "0");
            command.add(baseName);

            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.directory(workspaceDir.toFile());
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();
            boolean finished = process.waitFor(Duration.ofSeconds(timeoutSeconds).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            String output = new String(process.getInputStream().readAllBytes());
            if (!finished) {
                process.destroyForcibly();
                throw new CustomException("ODA File Converter bi timeout khi convert DWG.");
            }
            if (process.exitValue() != 0) {
                throw new CustomException("ODA File Converter loi khi convert DWG: " + trimOutput(output));
            }

            Path expectedDxf = outputDir.resolve(replaceExtension(baseName, "dxf"));
            if (!Files.exists(expectedDxf)) {
                Optional<Path> fallback = Files.list(outputDir)
                        .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".dxf"))
                        .findFirst();
                if (fallback.isPresent()) {
                    expectedDxf = fallback.get();
                } else {
                    throw new CustomException("ODA File Converter khong sinh ra file DXF nhu mong doi.");
                }
            }
            return new OdaConversionResult(expectedDxf, trimOutput(output));
        } catch (CustomException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new CustomException("Khong the chay ODA File Converter.");
        }
    }

    private String replaceExtension(String fileName, String newExtension) {
        int dotIndex = fileName.lastIndexOf('.');
        String baseName = dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
        return baseName + "." + newExtension;
    }

    private String trimOutput(String output) {
        if (!StringUtils.hasText(output)) {
            return "";
        }
        String normalized = output.trim().replaceAll("\\s+", " ");
        return normalized.length() > 500 ? normalized.substring(0, 500) : normalized;
    }

    public record OdaConversionResult(Path dxfPath, String commandOutput) {
    }
}
