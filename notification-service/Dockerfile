# Minimal image (rule R-K8-5): a Java 17 runtime plus the jar built by Maven (run `mvn package` first).
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java","-jar","/app/app.jar"]
