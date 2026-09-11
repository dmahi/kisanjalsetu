const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { ValidationPipe } = require('@nestjs/common');
const { mkdirSync } = require('fs');
const { join } = require('path');
const { AppModule } = require('../dist/app.module');
const { AllExceptionsFilter } = require('../dist/common/filters/all-exceptions.filter');

let appPromise = null;

async function bootstrap() {
  if (!appPromise) {
    appPromise = (async () => {
      const app = await NestFactory.create(AppModule);
      const config = app.get(ConfigService);

      app.enableCors({
        origin: (config.get('CORS_ORIGINS', 'http://localhost:5173') || '')
          .split(',')
          .map((o) => o.trim()),
        credentials: true,
      });

      try { mkdirSync(join(process.cwd(), 'uploads'), { recursive: true }); } catch { /* serverless: ignore */ }
      app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
        }),
      );
      app.useGlobalFilters(new AllExceptionsFilter());

      await app.init();
      return app.getHttpAdapter().getInstance();
    })();
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const app = await bootstrap();
  return app(req, res);
};