import { createBuilder } from './.aspire/modules/aspire.mjs';

const builder = await createBuilder();

await builder
  .addViteApp('spike', '../spike')
  .withNpm({ install: false });

await builder.build().run();
