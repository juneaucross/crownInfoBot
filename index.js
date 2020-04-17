process.env["NTBA_FIX_319"] = 1;

const Telegraf = require('telegraf');
const fetch = require('node-fetch');
const commandParts = require('telegraf-command-parts');

const token = process.env.TOKEN;
const port = process.env.PORT || 3000;
const url = process.env.URL || 'https://crowninfobot.herokuapp.com';

const bot = new Telegraf(token);

bot.telegram.setWebhook(`${url}/bot${token}`);
bot.startWebhook(`/bot${token}`, null, port);
bot.use(commandParts());

console.log('bot started');
bot.hears('hi', (ctx) => {
  console.log(ctx);
  ctx.reply('Hey there');
});

const checkStatus = (res) => {
  if (res.ok) {
    return res;
  } else {
    throw new Error(res.statusText);
  }
}

const checkFlag = (res) => {
  if (res.ok) {
    return res;
  } else {
    return 'https://raw.githubusercontent.com/juneaucross/crownInfoBot/master/crowninfologo.jpg';
  }
}

let logs = [];
const pushLogs = (ctx) => {
  if (ctx.inlineQuery) {
    logs.push({
      name: ctx.inlineQuery.from.username || `${ctx.inlineQuery.from.first_name} ${ctx.inlineQuery.from.last_name}`,
      text: ctx.inlineQuery.query || 'none ;(',
      chat: 'inline'
    });
  } else if (!ctx.inlineQuery) {
    logs.push({
      name: ctx.message.from.username || `${ctx.message.from.first_name} ${ctx.message.from.last_name}`,
      text: ctx.message.text,
      chat: ctx.message.chat.title || 'private'
    });
  }
};

const getCovidAlliasInfo = (ctx, countryArg) => {
  pushLogs(ctx);
  const countryName = countryArg || ctx.state.command.splitArgs[0].toLowerCase();
  const promise = fetch(`https://coronavirus-19-api.herokuapp.com/countries/${countryName}`);
  promise.then(checkStatus)
    .then((data) => data.json())
    .then(({ country, cases, todayCases, deaths, todayDeaths, recovered, active, totalTests }) => {
      let casesToTestsRatio;
      if (totalTests === 0) {
        casesToTestsRatio = 'tests have not been conducted';
      } else if ((cases/totalTests).toFixed(2) < 0.0001) {
        casesToTestsRatio = `${(cases/totalTests).toFixed(2)*100}% (${(cases/totalTests).toFixed(4)})`
      } else {
        casesToTestsRatio = `${(cases/totalTests).toFixed(2)*100}%`;
      }
      ctx.replyWithHTML(`<pre>Country: ${country}
Cases: ${cases}
Today cases: ${todayCases}
Deaths: ${deaths}
Today deaths: ${todayDeaths}
Recovered: ${recovered}
Active cases: ${active}
Total tests: ${totalTests}
Testing trend: ${casesToTestsRatio}
</pre>`);
    })
    .catch((err) => {
      console.log(err);
      ctx.reply('Something went wrong. Try again.');
    }
  )
};

const getCovidInfo = (ctx) => {
  const { command } = ctx.state;
  if (command.args) {
    return getCovidAlliasInfo(ctx);
  } else {
    pushLogs(ctx);
    const promise = fetch(`https://coronavirus-19-api.herokuapp.com/all`);
    promise.then(checkStatus)
      .then((data) => data.json())
      .then(({ cases, deaths, recovered }) => {
        ctx.replyWithHTML(`<pre>Total in world:
${cases} cases
${deaths} died
${recovered} recovered
</pre>`);
      })
      .catch((err) => {
        console.log(err);
        ctx.reply('Something went wrong. Try again.');
      }
    )
  }
};

try {
  bot.on('inline_query', (ctx) => {
    let results;
    if (!ctx.inlineQuery.query) {
      pushLogs(ctx);
      results = [];
      const promise = fetch(`https://coronavirus-19-api.herokuapp.com/all`);
      promise.then(checkStatus)
        .then((data) => data.json())
        .then(({ cases, deaths, recovered }) => {
          results.push({
            type: 'article',
            id: cases,
            title: `Global situation`,
            description: `Cases ${cases}`,
            thumb_url: 'https://www.wrpawprint.com/wp-content/uploads/2018/06/EARTH-FREE-PHOTO.jpg',
            input_message_content: {
              message_text: `Global cases: ${cases}
Global deaths: ${deaths}
Total recoveries: ${recovered}`
            }
          })
        })
        .then(() => {
          ctx.answerInlineQuery(results);
        })
        .catch((err) => {
          console.log(err);
        })
    } else {
      pushLogs(ctx);
      results = [];
      let countries = fetch('https://coronavirus-19-api.herokuapp.com/countries');
      countries.then(checkStatus)
        .then((data) => data.json())
        .then((data) => {
          return data.filter(({country}) => {
            return country.toLowerCase().includes(ctx.inlineQuery.query.toLowerCase());
          });
        })
        .then((filteredData) => {
          filteredData.forEach((item) => {
            let casesToTestsRatio;
            if (item.totalTests === 0) {
              casesToTestsRatio = 'tests have not been conducted';
            } else if ((item.cases/item.totalTests).toFixed(2) < 0.0001) {
              casesToTestsRatio = `${(item.cases/item.totalTests).toFixed(2)*100}% (${(item.cases/item.totalTests).toFixed(4)})`
            } else {
              casesToTestsRatio = `${(item.cases/item.totalTests).toFixed(2)*100}%`;
            }
            let formattedCountry = item.country.replace(/ /g, '-').toLowerCase();

            let thumb_url = fetch(`https://assets.thebasetrip.com/api/v2/countries/flags/${formattedCountry}.png`);
            thumb_url.then(res => checkFlag(res))
              .then(data => data)

            results.push({
              type: 'article',
              id: item.country,
              title: item.country,
              description: `Cases: ${item.cases}`,
              thumb_url: thumb_url.toString(),
              input_message_content: {
                message_text: `Country: ${item.country}
Cases: ${item.cases}
Today cases: ${item.todayCases}
Deaths: ${item.deaths}
Today deaths: ${item.todayDeaths}
Recovered: ${item.recovered}
Active cases: ${item.active}
Total tests: ${item.totalTests}
Testing trend: ${casesToTestsRatio}`
              }
            })
          });
        })
        .then(() => {
          ctx.answerInlineQuery(results);
        })
        .catch((err) => {
          console.log(err);
        }
      );
    }
  });
} catch (e) {
  console.log(e);
}

bot.command('covid', (ctx) => getCovidInfo(ctx));
bot.command('covidita', (ctx) => getCovidAlliasInfo(ctx, 'italy'));
bot.command('covidrus', (ctx) => getCovidAlliasInfo(ctx, 'russia'));
bot.command('covidswiss', (ctx) => getCovidAlliasInfo(ctx, 'switzerland'));

bot.hears('loggg', () => {
  console.log('queries amount:', logs.length);
  console.log(logs);
  let str = `Queries amount: ${logs.length} `;
  logs.forEach((log, i) => {
    str +=`\n\n• Name: ${log.name}, \ntext: ${log.text}, \nchat: ${log.chat}`;
  });
  bot.telegram.sendMessage(-219760410, str)
    .catch((err) => { console.log(`error in ${i} msg`, err); });
});

bot.launch();
