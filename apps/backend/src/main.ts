import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin.startsWith("http://localhost:")) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
