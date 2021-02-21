const {Telegraf, Scenes, Markup, session} = require('telegraf')
const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

let banList = {
  users: []
}

const certPath = path.join(__dirname, './banList.json')

const bot = new Telegraf(process.env.TG_TOKEN)

const createPostScene = new Scenes.WizardScene(
  'CREATE_POST',
  // Ввод заголовка поста
  (ctx) => {
    if (ctx.message.text === '/start') {
      ctx.reply(
        'Для отправки поста нажмите на кнопку ниже',
        {reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
      )
      return ctx.scene.leave()
    }

    try {
      ctx.wizard.state.post = {}
      ctx.reply('Введите заголовок вашего поста')
      return ctx.wizard.next()
    } catch (err) {
      console.log('Ошибка при добавлении заголовка')
      console.error(err)
    }
  },
    // Ввод текст поста
  (ctx) => {
    if (ctx.message.text === '/start') {
      ctx.reply(
        'Для отправки поста нажмите на кнопку ниже',
        {reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
      )
      return ctx.scene.leave()
    }

    try {
      if (ctx.message.text.length < 5 || ctx.message.text.length > 26) {
        ctx.reply('Заголовок должен содержать минимум 5 символов и максимум 25')
        return
      }

      ctx.wizard.state.post.title = ctx.message.text
      ctx.reply('Введите текст вашего поста')
      return ctx.wizard.next()
    } catch (err) {
      console.log('Ошибка при добавлении текста поста')
      console.error(err)
    }
  },
  // Ввод хэштега
  (ctx) => {
    if (ctx.message.text === '/start') {
      ctx.reply(
        'Для отправки поста нажмите на кнопку ниже',
        {reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
      )
      return ctx.scene.leave()
    }

    try {
      if (ctx.message.text.length < 10 || ctx.message.text.length > 4096) {
        ctx.reply('Текст поста должен содержать минимум 10 символов, максимум 4096')
        return
      }

      ctx.wizard.state.post.postText = ctx.message.text

      const message = 'Теперь выберите хэштег, нажав на подходящий:'

      const tagsKeyboard = Markup.keyboard([
        ['#Дети','#Семья'],
        ['#Мода','#Красота'],
        ['#Психология','#Здоровье'],
        ['#Хобби','#Быт'],
        ['#Учёба','#Работа'],
        ['#Виза','#Документы'],
        ['#Законы','#Жизнь_в_Германии'],
        ['#Путешествия','#Истории'],
        ['#Животные','#Прочее']
      ]).oneTime(true).resize(true).reply_markup
    
      ctx.reply(message, {parse_mode: 'HTML', reply_markup: tagsKeyboard})
      return ctx.wizard.next()
    } catch (err) {
      console.log('Ошибка при добалении хэштега')
      console.error(err)
    }
  },
  // Проверка поста пользователем
  async (ctx) => {
    if (ctx.message.text === '/start') {
      ctx.reply(
        'Для отправки поста нажмите на кнопку ниже',
        {reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
      )
      return ctx.scene.leave()
    }

    try {
      ctx.wizard.state.post.tag = ctx.message.text
      let post = ctx.wizard.state.post
    
      await ctx.reply('Принято!\n\nПеред отправкой посмотрите, как выглядит ваш пост:')
    
      const message = `<b>${post.title}</b>\n\n` + `${post.postText}\n\n` + `${post.tag}`
      ctx.wizard.state.finalPost = `${post.title}\n\n` + `${post.postText}\n\n` + `${post.tag}`
    
      await ctx.reply(message, {parse_mode: 'HTML'})
    
      await ctx.reply(
        'Отправляем?', 
        { reply_markup: Markup.keyboard([['✅ Да'], ['⛔️ Нет']]).oneTime(true).resize(true).reply_markup }
      )

      return ctx.wizard.next()
    } catch (err) {
      console.log('Ошибка при проверке поста')
      console.error(err)
    }
  },
  // Отправка поста в vk
  async (ctx) => {
    if (ctx.message.text === '/start') {
      ctx.reply(
        'Для отправки поста нажмите на кнопку ниже',
        {reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
      )
      return ctx.scene.leave()
    }

    switch(ctx.message.text){
      case '✅ Да':
        try {
          const successfulMessage = '<b>Пост отправлен в <i>Подруги в Германии</i></b>\n\n' + 
          'Модераторы сообщества проверят Ваш пост и опубликуют его на стене в ближайшее время,' +
          'если он соответствует требованиям канала к предлагаемым постам'
          
          let bodyFormData = new FormData()
          bodyFormData.append('owner_id', process.env.PUBLIC_ID)
          bodyFormData.append('message', ctx.wizard.state.finalPost)
          bodyFormData.append('access_token', process.env.VK_TOKEN)
          bodyFormData.append('v', process.env.VK_VERSION)

          if (banList.users.includes(String(ctx.message.from.id))) {
            await ctx.reply(
              successfulMessage, 
              {parse_mode: 'HTML', reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
            )
          } else {
            await axios({
              method: 'post',
              url: 'https://api.vk.com/method/wall.post',
              data: bodyFormData,
              headers: bodyFormData.getHeaders(),
            })

            await ctx.telegram.sendMessage('-518188358', ctx.wizard.state.finalPost)
        
            console.log('Пост был успешно отправлен в группу vk и telegram')
  
            const messageForAdmin = `Пользователь ${ctx.message.from.username} с id: ${ctx.message.from.id} отправил текст:\n\n` + ctx.wizard.state.finalPost
            const userId = ctx.message.from.id
  
            await ctx.telegram.sendMessage(process.env.TG_ADMIN_ID, messageForAdmin, {parse_mode: 'HTML'})
            await ctx.telegram.sendMessage(process.env.TG_ADMIN_ID, userId)
        
            await ctx.reply(
              successfulMessage, 
              {parse_mode: 'HTML', reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
            )
          }

          return ctx.scene.leave()
        } catch (e) {
          console.log('Возникла ошибка при отправке поста в vk')
          console.error(e)
          ctx.reply(
            'Не удалось отправить пост. Попробуйте еще раз',
            {reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup}
          )
      
          return ctx.scene.leave()
        } 
      case '⛔️ Нет':
        try {
          ctx.reply('Вы отменили отправку поста. Начните отправку заново.\n\nВведите заголовок вашего поста')
        } catch (err) {
          console.log('Ошибка при отмене отправки поста')
          console.error(err)
        }
        return ctx.wizard.selectStep(1)
      default:
        return
    }
  }
)

const stage = new Scenes.Stage([createPostScene])
bot.use(session())
bot.use(stage.middleware())

bot.command('start', ctx => {

  const message = 'Подруги в Германии – это дискуссионный клуб, а не справочная и вопросы в которых нечего обсуждать, мы не публикуем:' + 
  '\n\n❌ Поиск услуг (гинеколога, парикмахера, стилиста и прочих) ' +
  '\n❌ Купля и продажа чего-либо (наше сообщество не барахолка)' +
  '\n❌ Поиск подруг (отдельно подобные вопросы не публикуем)' +
  '\n❌ Поиск и предложение работы' +
  '\n\n<b>Для отправки поста нажмите на кнопку ниже</b> '

  try {
    ctx.reply(
      message, 
      {
        parse_mode: 'HTML', 
        reply_markup: Markup.keyboard([['✅ Написать пост']]).oneTime(true).resize(true).reply_markup
      }
    )
  } catch(err) {
    console.log('Ошибка при команде start')
    console.error(err)
  }
})

bot.hears('✅ Написать пост', ctx => {
  try {
    ctx.scene.enter('CREATE_POST')
  } catch (err) {
    console.log('ошибка при обработке "Написать пост"')
    console.error(err)
  }
})

// Обработчик бана пользователей
bot.hears('banUser', async ctx => {
  let userId = ctx.message.reply_to_message.text
  try {
    banList = JSON.parse(fs.readFileSync(certPath, 'utf8'))
    if (banList.users.includes(userId) === false) {
      banList.users.push(userId)
      let data = JSON.stringify(banList)
      fs.writeFileSync(certPath, data)
      await ctx.telegram.sendMessage(process.env.TG_ADMIN_ID, `Пользователь ${userId} забанен`)
    } else {
      await ctx.telegram.sendMessage(process.env.TG_ADMIN_ID, `Пользователь ${userId} уже забанен`)
    }
  } catch (err) {
    console.log(err)
    ctx.telegram.sendMessage(process.env.TG_ADMIN_ID, 'Забанить не получилось')
  }
})

// Обработчик обновления бан-листа
bot.hears('updateBanList', async ctx => {
  banList = await JSON.parse(fs.readFileSync(certPath, 'utf8'))
  ctx.telegram.sendMessage(process.env.TG_ADMIN_ID, 'Бан-лист обновлен ')
})

// Обработчик проверка бан-листа
bot.hears('checkBanList', ctx => {
  ctx.reply(banList.users)
})

bot.on('text', ctx => {
  ctx.reply('Если что-то пошло не так, попробуй сначала, написав команду /start')
})

bot.launch()