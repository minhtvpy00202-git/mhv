package com.poly.mhv.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.Ordered;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class LocalPostgresDatabaseBootstrap implements BeanFactoryPostProcessor, EnvironmentAware, Ordered {

    private static final Logger log = LoggerFactory.getLogger(LocalPostgresDatabaseBootstrap.class);

    private static final Pattern LOCAL_POSTGRES_URL_PATTERN = Pattern.compile(
        "^jdbc:postgresql://(?<host>localhost|127\\.0\\.0\\.1)(:(?<port>\\d+))?/(?<database>[A-Za-z0-9_]+)(?<query>\\?.*)?$",
        Pattern.CASE_INSENSITIVE
    );

    private Environment environment;

    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
        if (!Boolean.parseBoolean(environment.getProperty("app.local-db.auto-create.enabled", "true"))) {
            return;
        }

        String driverClassName = environment.getProperty(
            "spring.datasource.driver-class-name",
            "org.postgresql.Driver"
        );
        if (!driverClassName.toLowerCase().contains("postgresql")) {
            return;
        }

        String datasourceUrl = environment.getProperty("spring.datasource.url");
        String username = environment.getProperty("spring.datasource.username");
        String password = environment.getProperty("spring.datasource.password", "");

        if (!StringUtils.hasText(datasourceUrl) || !StringUtils.hasText(username)) {
            return;
        }

        Matcher matcher = LOCAL_POSTGRES_URL_PATTERN.matcher(datasourceUrl);
        if (!matcher.matches()) {
            return;
        }

        String targetDatabase = matcher.group("database");
        if ("postgres".equalsIgnoreCase(targetDatabase)) {
            return;
        }

        String port = StringUtils.hasText(matcher.group("port")) ? matcher.group("port") : "5432";
        String adminUrl = "jdbc:postgresql://localhost:" + port + "/postgres";

        try {
            Class.forName(driverClassName);
            ensureDatabaseExists(adminUrl, targetDatabase, username, password);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Khong tim thay PostgreSQL driver de khoi tao database local.", exception);
        }
    }

    private void ensureDatabaseExists(String adminUrl, String targetDatabase, String username, String password) {
        try (Connection connection = DriverManager.getConnection(adminUrl, username, password)) {
            if (databaseExists(connection, targetDatabase)) {
                return;
            }

            try (Statement statement = connection.createStatement()) {
                statement.execute("CREATE DATABASE \"" + targetDatabase + "\"");
            }

            log.info("Da tao san database local '{}' cho moi truong phat trien.", targetDatabase);
        } catch (SQLException exception) {
            throw new IllegalStateException(
                "Khong the tu tao database local '" + targetDatabase
                    + "'. Hay dam bao PostgreSQL local dang chay va thong tin dang nhap dung.",
                exception
            );
        }
    }

    private boolean databaseExists(Connection connection, String targetDatabase) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
            "select 1 from pg_database where datname = ?"
        )) {
            statement.setString(1, targetDatabase);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }
}
