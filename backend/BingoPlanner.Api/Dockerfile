# --- сборка фронтенда (React + Vite) ---------------------------------------
FROM node:20-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# --- сборка и публикация API ------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS api
WORKDIR /src
COPY backend/BingoPlanner.Api/BingoPlanner.Api.csproj backend/BingoPlanner.Api/
RUN dotnet restore backend/BingoPlanner.Api/BingoPlanner.Api.csproj
COPY backend/ backend/
COPY --from=web /src/frontend/dist/ backend/BingoPlanner.Api/wwwroot/
RUN dotnet publish backend/BingoPlanner.Api/BingoPlanner.Api.csproj -c Release -o /app

# --- рантайм ----------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=api /app ./
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "BingoPlanner.Api.dll"]