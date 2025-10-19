FROM eclipse-temurin:21-jdk
ENV SERVER_PORT=8081
VOLUME /data
WORKDIR /app
COPY view/target/view-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8081
CMD ["java", "-jar", "app.jar"]
