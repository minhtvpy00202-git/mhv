FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw
RUN ./mvnw -q -DskipTests dependency:go-offline

COPY src src
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre
ARG ODA_DEB_URL=https://www.opendesign.com/guestfiles/get?filename=ODAFileConverter_QT6_lnxX64_8.3dll_27.1.deb
ARG ODA_DEB_PATH=/tmp/oda-file-converter.deb
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget xvfb libxcb-util1 libxrender1 libxext6 libx11-6 ca-certificates \
    && wget -O "${ODA_DEB_PATH}" "${ODA_DEB_URL}" \
    && apt-get install -y --no-install-recommends "${ODA_DEB_PATH}" \
    && rm -f "${ODA_DEB_PATH}" \
    && if [ -e /usr/lib/x86_64-linux-gnu/libxcb-util.so.1 ] && [ ! -e /usr/lib/x86_64-linux-gnu/libxcb-util.so.0 ]; then ln -s /usr/lib/x86_64-linux-gnu/libxcb-util.so.1 /usr/lib/x86_64-linux-gnu/libxcb-util.so.0; fi \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/*.jar app.jar
RUN mkdir -p /app/uploads /opt/oda

ENV APP_UPLOAD_DIR=/app/uploads
ENV APP_ASSET_MAP_IMPORT_ODA_EXECUTABLE_PATH=/usr/bin/ODAFileConverter
ENV APP_ASSET_MAP_IMPORT_ODA_USE_XVFB=true

EXPOSE 8080
CMD ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
