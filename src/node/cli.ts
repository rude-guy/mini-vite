import cac from 'cac';

const cli = cac();

cli
  .command('[root]', 'Run the development server')
  .alias('serve')
  .alias('dev')
  .action((args) => {
    console.log('cli 启动');
  });

cli.parse();

cli.help();
