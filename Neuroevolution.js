var Neuroevolution = function (options) {
  var self = this;
  self.options = {
    /**
     * Logistic 激活函数
     */
    activation: function (a) {
      ap = -a / 1;
      return 1 / (1 + Math.exp(ap));
    },
    /**
     * 生成 -1 到 1 的随机数
     */
    randomClamped: function () {
      return Math.random() * 2 - 1;
    },
    // 神经网络结构
    network: [1, [1], 1], // 默认1个输入，1个隐藏层（1个神经元），1个输出
    // 每轮生成的小鸟数
    population: 100,
    // 保留上代表现最好的小鸟占比
    elitism: 0.2,
    // 每代产生的全新基因小鸟占比
    randomBehaviour: 0.2,
    // 变异率
    mutationRate: 0.1,
    // 变异程度
    mutationRange: 0.5,
    // 根据分数排序 (-1 = desc, 1 = asc)
    scoreSort: -1,
    // 繁衍子代数量
    nbChild: 1,
  };

  self.set = function (options) {
    for (var i in options) {
      if (this.options[i] != undefined) {
        self.options[i] = options[i];
      }
    }
  };

  self.set(options);

  /**
   * 人工神经元
   */
  var Neuron = function () {
    this.value = 0;
    this.weights = [];
  };

  /**
   * 随机初始化神经元各参数权重
   */
  Neuron.prototype.populate = function (nb) {
    this.weights = [];
    for (var i = 0; i < nb; i++) {
      this.weights.push(self.options.randomClamped());
    }
  };

  /**
   * 神经网络层
   *
   * @index 第几层网络
   */
  var Layer = function (index) {
    this.id = index || 0;
    this.neurons = [];
  };

  /**
   * 随机初始化神经元网络层
   *
   * @nbNeurons 神经元个数
   * @nbInputs 输入参数个数
   */
  Layer.prototype.populate = function (nbNeurons, nbInputs) {
    this.neurons = [];
    for (var i = 0; i < nbNeurons; i++) {
      var n = new Neuron();
      n.populate(nbInputs);
      this.neurons.push(n);
    }
  };

  /**
   * 神经网络
   *
   * 由多层神经元依次连接而成
   *
   * 每层由多个神经元构成
   */
  var Network = function () {
    this.layers = [];
  };

  /**
   * 生成神经网络
   *
   * @input 输入层神经元个数
   * @output 输出层神经元个数
   * @hidden 隐藏层即各层神经元数量
   */
  Network.prototype.perceptronGeneration = function (input, hiddens, output) {
    var index = 0;
    var previousNeurons = 0;
    // 输入层
    var layer = new Layer(index);
    layer.populate(input, previousNeurons);
    previousNeurons = input;
    this.layers.push(layer);
    index++;
    for (var i in hiddens) {
      //初始化每个隐藏层
      var layer = new Layer(index);
      layer.populate(hiddens[i], previousNeurons);
      previousNeurons = hiddens[i];
      this.layers.push(layer);
      index++;
    }
    // 输出层
    var layer = new Layer(index);
    layer.populate(output, previousNeurons);
    this.layers.push(layer);
  };

  /**
   * 导出当前神经网络
   */
  Network.prototype.getSave = function () {
    var datas = {
      neurons: [], // 神经元
      weights: [], // 每个输入神经元的权重
    };

    for (var i in this.layers) {
      datas.neurons.push(this.layers[i].neurons.length);
      for (var j in this.layers[i].neurons) {
        for (var k in this.layers[i].neurons[j].weights) {
          datas.weights.push(this.layers[i].neurons[j].weights[k]);
        }
      }
    }
    return datas;
  };

  /**
   * 还原导入的神经网络
   */
  Network.prototype.setSave = function (save) {
    var previousNeurons = 0;
    var index = 0;
    var indexWeights = 0;
    this.layers = [];
    for (var i in save.neurons) {
      var layer = new Layer(index);
      layer.populate(save.neurons[i], previousNeurons);
      for (var j in layer.neurons) {
        for (var k in layer.neurons[j].weights) {
          layer.neurons[j].weights[k] = save.weights[indexWeights];
          indexWeights++;
        }
      }
      previousNeurons = save.neurons[i];
      index++;
      this.layers.push(layer);
    }
  };

  /**
   * 神经网络根据输入计算输出
   */
  Network.prototype.compute = function (inputs) {
    // 将输入数据输入神经网络输入层
    for (var i in inputs) {
      if (this.layers[0] && this.layers[0].neurons[i]) {
        this.layers[0].neurons[i].value = inputs[i];
      }
    }

    var prevLayer = this.layers[0];
    for (var i = 1; i < this.layers.length; i++) {
      // 遍历每层网络
      for (var j in this.layers[i].neurons) {
        // 遍历每个神经元
        var sum = 0;
        for (var k in prevLayer.neurons) {
          // 计算当前神经元收到的上层连接神经元的总输出值
          sum +=
            prevLayer.neurons[k].value * this.layers[i].neurons[j].weights[k];
        }
        // 计算神经元激活状态
        this.layers[i].neurons[j].value = self.options.activation(sum);
      }
      prevLayer = this.layers[i];
    }

    // 获取输出层结果
    var out = [];
    var lastLayer = this.layers[this.layers.length - 1];
    for (var i in lastLayer.neurons) {
      out.push(lastLayer.neurons[i].value);
    }
    return out;
  };

  /**
   * 基因🧬
   *
   * 由网络和分数构成，代表每个小鸟的游戏经验
   */
  var Genome = function (score, network) {
    this.score = score || 0;
    this.network = network || null;
  };

  /**
   * 繁衍世代
   *
   * 由多个独立的小鸟基因构成
   *
   */
  var Generation = function () {
    this.genomes = [];
  };

  /**
   * 向一个繁衍世代中添加新的基因
   */
  Generation.prototype.addGenome = function (genome) {
    // 按照分数排序
    for (var i = 0; i < this.genomes.length; i++) {
      if (self.options.scoreSort < 0) {
        // 倒序
        if (genome.score > this.genomes[i].score) {
          break;
        }
      } else {
        // 正序
        if (genome.score < this.genomes[i].score) {
          break;
        }
      }
    }
    this.genomes.splice(i, 0, genome);
  };

  /**
   * 根据基因组繁衍后代
   */
  Generation.prototype.breed = function (g1, g2, nbChilds) {
    var datas = [];
    for (var nb = 0; nb < nbChilds; nb++) {
      // 克隆基因组1
      var data = JSON.parse(JSON.stringify(g1));
      for (var i in g2.network.weights) {
        // 与基因组2随机生成基因交叉（0.5为交叉因数）
        if (Math.random() <= 0.5) {
          data.network.weights[i] = g2.network.weights[i];
        }
      }
      // 在基因交叉后，继续进行基因变异
      for (var i in data.network.weights) {
        if (Math.random() <= self.options.mutationRate) {
          // 对部分权重按照一定比例和幅度进行随机调整
          data.network.weights[i] +=
            Math.random() * self.options.mutationRange * 2 -
            self.options.mutationRange;
        }
      }
      datas.push(data);
    }
    return datas;
  };

  /**
   * 生成下一世代的小鸟
   */
  Generation.prototype.generateNextGeneration = function () {
    var nexts = [];
    for (
      var i = 0;
      i < Math.round(self.options.elitism * self.options.population);
      i++
    ) {
      if (nexts.length < self.options.population) {
        // 克隆上一轮分数最高的几个小鸟的基因
        nexts.push(JSON.parse(JSON.stringify(this.genomes[i].network)));
      }
    }

    for (
      var i = 0;
      i < Math.round(self.options.randomBehaviour * self.options.population);
      i++
    ) {
      // 随机生成新的基因
      var n = JSON.parse(JSON.stringify(this.genomes[0].network));
      for (var k in n.weights) {
        n.weights[k] = self.options.randomClamped();
      }
      if (nexts.length < self.options.population) {
        nexts.push(n);
      }
    }

    var max = 0;
    while (true) {
      for (var i = 0; i < max; i++) {
        // 剩余的小鸟由之前的各代小鸟繁衍生成，越新的父代繁衍能力越强
        var childs = this.breed(
          this.genomes[i],
          this.genomes[max],
          self.options.nbChild > 0 ? self.options.nbChild : 1
        );
        for (var c in childs) {
          nexts.push(childs[c].network);
          if (nexts.length >= self.options.population) {
            // 当达到目标数量，则停止繁衍
            return nexts;
          }
        }
      }
      max++;
      if (max >= this.genomes.length - 1) {
        max = 0;
      }
    }
  };

  /**
   * 族谱
   *
   * 由历史世代和当前世代组成
   */
  var Generations = function () {
    this.generations = [];
    var currentGeneration = new Generation();
  };

  /**
   * 生成并保存创世代
   */
  Generations.prototype.firstGeneration = function (input, hiddens, output) {
    var out = [];
    for (var i = 0; i < self.options.population; i++) {
      var nn = new Network();
      nn.perceptronGeneration(
        self.options.network[0],
        self.options.network[1],
        self.options.network[2]
      );
      out.push(nn.getSave());
    }
    this.generations.push(new Generation());
    return out;
  };

  /**
   * 生成下一世代
   */
  Generations.prototype.nextGeneration = function () {
    if (this.generations.length == 0) {
      return false;
    }
    var gen =
      this.generations[this.generations.length - 1].generateNextGeneration();
    this.generations.push(new Generation());
    return gen;
  };

  /**
   * 向当前世代添加新的基因
   */
  Generations.prototype.addGenome = function (genome) {
    if (this.generations.length == 0) return false;
    return this.generations[this.generations.length - 1].addGenome(genome);
  };

  self.generations = new Generations();

  /**
   * 重置族谱数据，重新开始基因进化
   */
  self.restart = function () {
    self.generations = new Generations();
  };

  self.nextGeneration = function () {
    var networks = [];

    if (self.generations.generations.length == 0) {
      // 创世代
      networks = self.generations.firstGeneration();
    } else {
      // 繁衍进化下一世代
      networks = self.generations.nextGeneration();
    }
    // 从当前生成的新世代创建神经网络
    var nns = [];
    for (var i in networks) {
      var nn = new Network();
      nn.setSave(networks[i]);
      nns.push(nn);
    }
    return nns;
  };

  /**
   * 添加一个带有网络和分数的新的基因
   */
  self.networkScore = function (network, score) {
    self.generations.addGenome(new Genome(score, network.getSave()));
  };
};
