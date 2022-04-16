// 决策网络
var Neuvol;
var game;
var FPS = 60;
var maxScore = 0;
// 缓存的图片资源
var images = {};

(function () {
  // 设置 canvas 为屏幕宽度
  const canvas = document.querySelector("#flappy");
  const resize = () => {
    canvas.width = window.innerWidth;
  };
  resize();
  window.addEventListener("resize", resize);
})();

window.onload = function () {
  var sprites = {
    bird: "./img/bird.png",
    background: "./img/background.png",
    pipetop: "./img/pipetop.png",
    pipebottom: "./img/pipebottom.png",
  };

  var start = function () {
    Neuvol = new Neuroevolution({
      population: 50,
      network: [2, [2], 1], // 2个输入，1个隐藏层(2神经元)，1个输出
    });
    game = new Game();
    game.start();
    game.update();
    game.display();
  };

  // 加载图片
  loadImages(sprites, function (imgs) {
    images = imgs;
    // 开始游戏
    start();
  });
};

var Game = function () {
  this.score = 0;
  this.maxScore = 0;
  this.pipes = [];
  this.birds = [];
  this.gen = [];
  this.alives = 0;
  this.generation = 0;

  // 每周期间隔数
  this.spawnInterval = 90;
  // 当前周期累计间隔数
  this.interval = 0;
  // 背景移动速度
  this.backgroundSpeed = 0.5;
  // 背景x轴坐标
  this.backgroundx = 0;
  this.canvas = document.querySelector("#flappy");
  this.ctx = this.canvas.getContext("2d");
  this.width = this.canvas.width;
  this.height = this.canvas.height;
};

Game.prototype.start = function () {
  this.interval = 0;
  this.score = 0;
  this.pipes = [];
  this.birds = [];
  // 生成下一轮小鸟
  this.gen = Neuvol.nextGeneration();
  for (var i in this.gen) {
    var b = new Bird();
    this.birds.push(b);
  }
  this.generation++;
  this.alives = this.birds.length;
};

Game.prototype.update = function () {
  // 移动背景
  this.backgroundx += this.backgroundSpeed;
  // 下一个管道缺口高度
  var nextHollY = 0;
  if (this.birds.length > 0) {
    for (var i = 0; i < this.pipes.length; i += 2) {
      if (this.pipes[i].x + this.pipes[i].width > this.birds[0].x) {
        // 找到下一个管道
        nextHollY = this.pipes[i].height;
        break;
      }
    }
  }

  for (var i in this.birds) {
    if (this.birds[i].alive) {
      // 输入参数（归一化）
      var inputs = [
        this.birds[i].y / this.height, // 鸟的高度
        nextHollY / this.height, // 缺口纵坐标
      ];
      // 根据输入计算是否需要让鸟向上飞
      var res = this.gen[i].compute(inputs);
      if (res > 0.5) {
        // 让鸟向上飞
        this.birds[i].flap();
      }
      // 更新鸟的位置
      this.birds[i].update();
      // 检查位置更新后的鸟是否挂掉
      if (this.birds[i].isDead(this.height, this.pipes)) {
        this.birds[i].alive = false;
        this.alives--;
        // 这只鸟挂了，更新决策网络分数
        Neuvol.networkScore(this.gen[i], this.score);
        if (this.isOver()) {
          // 小鸟全部阵亡，重新开始
          this.start();
        }
      }
    }
  }

  for (var i = 0; i < this.pipes.length; i++) {
    // 更新管道位置
    this.pipes[i].update();
    if (this.pipes[i].isOut()) {
      // 回收超出屏幕的管道资源
      this.pipes.splice(i, 1);
      i--;
    }
  }

  if (this.interval == 0) {
    // 缺口长度
    var pipeHoll = 120;
    // 缺口距离上下边最小距离
    var deltaBord = 50;
    // 随机生成安全的缺口位置
    var hollPosition =
      Math.round(Math.random() * (this.height - deltaBord * 2 - pipeHoll)) +
      deltaBord;
    // 上管道
    this.pipes.push(new Pipe({ x: this.width, y: 0, height: hollPosition }));
    // 下管道
    this.pipes.push(
      new Pipe({
        x: this.width,
        y: hollPosition + pipeHoll,
        height: this.height,
      })
    );
  }
  // 帧数 +1
  this.interval++;
  if (this.interval == this.spawnInterval) {
    this.interval = 0;
  }
  // 分数 +1
  this.score++;
  this.maxScore = this.score > this.maxScore ? this.score : this.maxScore;
  var self = this;
  // 注册下一帧回调
  if (FPS == 0) {
    setZeroTimeout(function () {
      self.update();
    });
  } else {
    setTimeout(function () {
      self.update();
    }, 1000 / FPS);
  }
};

Game.prototype.isOver = function () {
  for (var i in this.birds) {
    if (this.birds[i].alive) {
      return false;
    }
  }
  // 小鸟全部阵亡，game over
  return true;
};

Game.prototype.display = function () {
  // 清空屏幕
  this.ctx.clearRect(0, 0, this.width, this.height);
  for (
    var i = 0;
    i < Math.ceil(this.width / images.background.width) + 1;
    i++
  ) {
    // 绘制背景
    this.ctx.drawImage(
      images.background,
      i * images.background.width -
        Math.floor(this.backgroundx % images.background.width),
      0
    );
  }

  for (var i in this.pipes) {
    if (i % 2 == 0) {
      // 绘制上管道
      this.ctx.drawImage(
        images.pipetop,
        this.pipes[i].x,
        this.pipes[i].y + this.pipes[i].height - images.pipetop.height,
        this.pipes[i].width,
        images.pipetop.height
      );
    } else {
      // 绘制下管道
      this.ctx.drawImage(
        images.pipebottom,
        this.pipes[i].x,
        this.pipes[i].y,
        this.pipes[i].width,
        images.pipetop.height
      );
    }
  }

  this.ctx.fillStyle = "#FFC600";
  this.ctx.strokeStyle = "#CE9E00";
  for (var i in this.birds) {
    if (this.birds[i].alive) {
      this.ctx.save();
      this.ctx.translate(
        this.birds[i].x + this.birds[i].width / 2,
        this.birds[i].y + this.birds[i].height / 2
      );
      // 根据小鸟所受合力计算其朝向
      this.ctx.rotate(((Math.PI / 2) * this.birds[i].gravity) / 20);
      // 绘制小鸟
      this.ctx.drawImage(
        images.bird,
        -this.birds[i].width / 2,
        -this.birds[i].height / 2,
        this.birds[i].width,
        this.birds[i].height
      );
      this.ctx.restore();
    }
  }

  // 绘制左上角文字
  this.ctx.fillStyle = "white";
  this.ctx.fillText("最高分数 : " + this.maxScore, 10, 25);
  this.ctx.fillText("当前分数 : " + this.score, 10, 50);
  this.ctx.fillText("当前存活 : " + this.alives, 10, 75);
  this.ctx.fillText("当前轮数 : " + this.generation, 10, 100);

  var self = this;
  requestAnimationFrame(function () {
    // 注册下一帧绘制回调
    self.display();
  });
};

var Bird = function (json) {
  this.x = 80;
  this.y = 250;
  this.width = 40;
  this.height = 30;

  this.alive = true;
  this.gravity = 0;
  this.velocity = 0.3;
  this.jump = -6;

  this.init(json);
};

Bird.prototype.init = function (json) {
  for (var i in json) {
    this[i] = json[i];
  }
};

Bird.prototype.flap = function () {
  this.gravity = this.jump;
};

Bird.prototype.update = function () {
  this.gravity += this.velocity;
  this.y += this.gravity;
};

Bird.prototype.isDead = function (height, pipes) {
  if (this.y >= height || this.y + this.height <= 0) {
    return true;
  }
  for (var i in pipes) {
    if (
      !(
        this.x > pipes[i].x + pipes[i].width ||
        this.x + this.width < pipes[i].x ||
        this.y > pipes[i].y + pipes[i].height ||
        this.y + this.height < pipes[i].y
      )
    ) {
      return true;
    }
  }
};

var Pipe = function (json) {
  this.x = 0;
  this.y = 0;
  this.width = 50;
  this.height = 40;
  this.speed = 3;

  this.init(json);
};

Pipe.prototype.init = function (json) {
  for (var i in json) {
    this[i] = json[i];
  }
};

Pipe.prototype.update = function () {
  this.x -= this.speed;
};

Pipe.prototype.isOut = function () {
  if (this.x + this.width < 0) {
    return true;
  }
};

// 加载图片资源
var loadImages = function (sources, callback) {
  var nb = 0;
  var loaded = 0;
  var imgs = {};
  for (var i in sources) {
    nb++;
    imgs[i] = new Image();
    imgs[i].src = sources[i];
    imgs[i].onload = function () {
      loaded++;
      if (loaded == nb) {
        // 图片加载完毕回调
        callback(imgs);
      }
    };
  }
};

// 更新 FPS
var speed = function (fps) {
  FPS = parseInt(fps);
};

(function () {
  // zero-timeout 消息队列，用于即时异步回调
  var timeouts = [];
  var messageName = "zero-timeout-message";

  function setZeroTimeout(fn) {
    timeouts.push(fn);
    window.postMessage(messageName, "*");
  }

  function handleMessage(event) {
    if (event.source == window && event.data == messageName) {
      event.stopPropagation();
      if (timeouts.length > 0) {
        var fn = timeouts.shift();
        fn();
      }
    }
  }

  window.addEventListener("message", handleMessage, true);

  window.setZeroTimeout = setZeroTimeout;
})();
