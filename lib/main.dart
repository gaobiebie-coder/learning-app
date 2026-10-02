import 'package:flutter/material.dart';

void main() {
  runApp(const LearningApp());
}

class LearningApp extends StatelessWidget {
  const LearningApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '每日学习',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const MainPage(),
    );
  }
}

class MainPage extends StatefulWidget {
  const MainPage({super.key});

  @override
  State<MainPage> createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  int _currentIndex = 0;

  final _pages = const [HomePage(), StudyPage(), ProfilePage()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: '首页'),
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), label: '学习'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: '我的'),
        ],
      ),
    );
  }
}

/// 首页：今日目标 + 每日单词卡
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _learnedWords = 3;
  final int _goalWords = 20;
  bool _showMeaning = false;

  @override
  Widget build(BuildContext context) {
    final progress = _learnedWords / _goalWords;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('你好，同学 👋',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('今天也要坚持学习哦',
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),

          // 今日目标卡片
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('今日目标',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(value: progress),
                  const SizedBox(height: 8),
                  Text('已学 $_learnedWords / $_goalWords 个单词'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 每日单词卡（点击翻面）
          GestureDetector(
            onTap: () => setState(() => _showMeaning = !_showMeaning),
            child: Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: SizedBox(
                height: 200,
                child: Center(
                  child: _showMeaning
                      ? const Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('n. 坚持；毅力',
                                style: TextStyle(fontSize: 22)),
                            SizedBox(height: 8),
                            Text('Persistence is the key to success.'),
                          ],
                        )
                      : const Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('persistence',
                                style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.bold)),
                            SizedBox(height: 8),
                            Text('点击查看释义'),
                          ],
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          FilledButton.icon(
            onPressed: () => setState(() {
              if (_learnedWords < _goalWords) _learnedWords++;
              _showMeaning = false;
            }),
            icon: const Icon(Icons.check),
            label: const Text('学会了，下一个'),
          ),
        ],
      ),
    );
  }
}

/// 学习页：课程列表
class StudyPage extends StatelessWidget {
  const StudyPage({super.key});

  static const _courses = [
    ('英语单词', Icons.abc, '四级核心 2000 词'),
    ('数学刷题', Icons.calculate_outlined, '每日 10 题'),
    ('阅读理解', Icons.article_outlined, '短篇精读'),
    ('错题本', Icons.bookmark_outline, '复习薄弱点'),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('学习模块', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          for (final (title, icon, subtitle) in _courses)
            Card(
              child: ListTile(
                leading: Icon(icon, size: 32),
                title: Text(title),
                subtitle: Text(subtitle),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {},
              ),
            ),
        ],
      ),
    );
  }
}

/// 我的：打卡与统计
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int _streakDays = 0;
  bool _checkedIn = false;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('我的', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text('连续学习',
                      style: Theme.of(context).textTheme.titleMedium),
                  Text('$_streakDays 天',
                      style: Theme.of(context).textTheme.displaySmall),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _checkedIn
                        ? null
                        : () => setState(() {
                              _checkedIn = true;
                              _streakDays++;
                            }),
                    child: Text(_checkedIn ? '今日已打卡 ✅' : '打卡'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
