"""
BugBash - Enterprise Unified Question Bank Service
Provides access to all platform questions (coding challenges and technical MCQs),
searching, filtering, previewing, and automatic question generation with strict
availability validation and zero duplicate question IDs.
"""

import copy
import logging
from typing import Dict, List, Optional, Tuple, Any

from backend.app.services.practice_service import practice_service

logger = logging.getLogger("bugbash.question_bank")


class QuestionBankService:
    """
    Centralized Question Bank service for BugBash.
    Reuses all practice coding problems and provides rich multi-language coding
    and MCQ questions for administrator assessment assembly.
    """

    def __init__(self):
        self._questions: Dict[str, dict] = {}
        self._init_question_bank()

    def _init_question_bank(self):
        """Initializes the unified Question Bank catalog."""
        # 1. Ingest practice problems (prob-01 to prob-14)
        for pid, prob in practice_service._problems.items():
            q_copy = copy.deepcopy(prob)
            q_copy["question_type"] = "coding"
            q_copy["points"] = q_copy.get("points", 20 if q_copy.get("difficulty") == "Easy" else 30 if q_copy.get("difficulty") == "Medium" else 40)
            self._questions[pid] = q_copy

        # 2. Add supplementary coding problems for language & difficulty breadth
        supplementary_coding = [
            {
                "id": "prob-15",
                "title": "Median of Two Sorted Arrays (O(log(m+n)))",
                "slug": "median-two-sorted-arrays",
                "difficulty": "Hard",
                "category": "Binary Search & Divide and Conquer",
                "languages": ["Python", "C++", "Java", "Go"],
                "acceptance_rate": "38%",
                "tags": ["Binary Search", "Array", "Divide & Conquer"],
                "points": 40,
                "question_type": "coding",
                "description": "Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays in O(log (m+n)) runtime complexity.",
                "input_format": "Line 1: Array nums1\nLine 2: Array nums2",
                "output_format": "Float with 5 decimal precision representing the median.",
                "constraints": ["nums1.length == m", "nums2.length == n", "0 <= m <= 1000", "1 <= m + n <= 2000"],
                "sample_test_cases": [{"input": "[1,3]\n[2]", "output": "2.00000"}],
                "hidden_test_cases": [{"input": "[1,2]\n[3,4]", "output": "2.50000"}]
            },
            {
                "id": "prob-16",
                "title": "Design a Distributed Thread-Safe LRU Cache",
                "slug": "thread-safe-lru-cache",
                "difficulty": "Medium",
                "category": "Concurrency & System Design",
                "languages": ["Java", "C++", "Python", "Go"],
                "acceptance_rate": "54%",
                "tags": ["Design", "Concurrency", "Synchronization", "Java"],
                "points": 30,
                "question_type": "coding",
                "description": "Implement a thread-safe Least Recently Used (LRU) Cache supporting get(key) and put(key, value) with O(1) average time complexity under high concurrency.",
                "input_format": "Commands array and parameters",
                "output_format": "Return values of get calls",
                "constraints": ["Capacity between 1 and 10000", "Concurrent reader and writer threads"],
                "sample_test_cases": [{"input": "capacity 2, put 1 1, put 2 2, get 1", "output": "1"}],
                "hidden_test_cases": [{"input": "capacity 1, put 1 10, put 2 20, get 1", "output": "-1"}]
            },
            {
                "id": "prob-17",
                "title": "Serialize and Deserialize Binary Tree (N-Ary)",
                "slug": "serialize-deserialize-binary-tree",
                "difficulty": "Hard",
                "category": "Trees & Serialization",
                "languages": ["Java", "C++", "Python"],
                "acceptance_rate": "44%",
                "tags": ["Tree", "Design", "String", "BFS"],
                "points": 40,
                "question_type": "coding",
                "description": "Design an algorithm to serialize and deserialize a binary tree to and from a string format.",
                "input_format": "Root node of binary tree",
                "output_format": "Serialized string and reconstructed tree equality check",
                "constraints": ["The number of nodes in the tree is in the range [0, 10^4]"],
                "sample_test_cases": [{"input": "[1,2,3,null,null,4,5]", "output": "[1,2,3,null,null,4,5]"}],
                "hidden_test_cases": [{"input": "[]", "output": "[]"}]
            },
            {
                "id": "prob-18",
                "title": "Custom Memory Allocator - Malloc Implementation",
                "slug": "custom-memory-allocator",
                "difficulty": "Easy",
                "category": "Memory & Systems",
                "languages": ["C", "C++"],
                "acceptance_rate": "72%",
                "tags": ["Pointers", "Memory", "Systems", "C"],
                "points": 20,
                "question_type": "coding",
                "description": "Implement a basic bump-pointer or free-list memory allocator in C/C++ supporting malloc and free for continuous heap segments.",
                "input_format": "Allocation block sizes",
                "output_format": "Pointer offsets and free status",
                "constraints": ["Maximum heap size 64KB"],
                "sample_test_cases": [{"input": "alloc(100), free()", "output": "OK"}],
                "hidden_test_cases": [{"input": "alloc(65536)", "output": "OK"}]
            },
            {
                "id": "prob-19",
                "title": "Deep Clone Object with Circular References",
                "slug": "deep-clone-circular-object",
                "difficulty": "Hard",
                "category": "JavaScript Engine & Objects",
                "languages": ["JavaScript", "Python"],
                "acceptance_rate": "46%",
                "tags": ["JavaScript", "Recursion", "WeakMap", "Algorithms"],
                "points": 40,
                "question_type": "coding",
                "description": "Implement a full structural deep clone in JavaScript that handles primitive types, nested objects, arrays, Dates, RegExps, and circular self-references using WeakMap.",
                "input_format": "JSON/Object with circular reference",
                "output_format": "Cloned object verifying identity distinctness",
                "constraints": ["Object nesting depth up to 1000", "Cycles must be correctly preserved"],
                "sample_test_cases": [{"input": "obj = { a: 1 }; obj.self = obj;", "output": "Cloned successfully"}],
                "hidden_test_cases": [{"input": "deepNestedArray", "output": "Cloned successfully"}]
            },
            {
                "id": "prob-20",
                "title": "Employee Department Salary Quartile Analysis",
                "slug": "employee-department-salary-quartile",
                "difficulty": "Easy",
                "category": "SQL & Relational Databases",
                "languages": ["SQL"],
                "acceptance_rate": "81%",
                "tags": ["SQL", "Aggregation", "GROUP BY", "Databases"],
                "points": 20,
                "question_type": "coding",
                "description": "Write an SQL query to retrieve each department name, total employee count, and average salary rounded to 2 decimal places, ordered by average salary descending.",
                "input_format": "Tables: Departments (id, name), Employees (id, name, salary, department_id)",
                "output_format": "Result table with columns: department_name, employee_count, avg_salary",
                "constraints": ["Non-empty tables, department_id references Departments(id)"],
                "sample_test_cases": [{"input": "Sample department rows", "output": "Aggregated rows"}],
                "hidden_test_cases": [{"input": "Empty department edge case", "output": "Zero rows"}]
            },
            {
                "id": "prob-21",
                "title": "Consecutive User Active Days & Window Functions",
                "slug": "consecutive-user-active-days",
                "difficulty": "Hard",
                "category": "SQL & Analytical Queries",
                "languages": ["SQL"],
                "acceptance_rate": "39%",
                "tags": ["SQL", "Window Functions", "LEAD/LAG", "Gaps and Islands"],
                "points": 40,
                "question_type": "coding",
                "description": "Using SQL window functions, detect users who have logged in for at least 5 consecutive days without interruption. Return user_id, streak_start_date, and streak_end_date.",
                "input_format": "Table: UserLogins (user_id, login_date)",
                "output_format": "Result table with columns: user_id, streak_start_date, streak_end_date",
                "constraints": ["Logins table may have multiple logins per user per day"],
                "sample_test_cases": [{"input": "10 consecutive rows for user 1", "output": "user 1 reported"}],
                "hidden_test_cases": [{"input": "4 consecutive rows for user 2", "output": "empty"}]
            }
        ]

        for p in supplementary_coding:
            self._questions[p["id"]] = p

        # 3. Add Technical MCQs (mcq-01 to mcq-12)
        technical_mcqs = [
            {
                "id": "mcq-01",
                "title": "Python Memory Management & Reference Cycles",
                "difficulty": "Medium",
                "category": "Python Internals",
                "languages": ["Python"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["Python", "Memory", "Garbage Collection"],
                "description": "How does CPython primarily detect and clean up circular reference cycles between objects?",
                "options": [
                    "A. Generational Cyclic Garbage Collector inspecting object tracking lists",
                    "B. Immediate reference counting without any background cycle detector",
                    "C. Operating system page fault heuristics",
                    "D. Manual programmer invocation of sys.deallocate()"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-02",
                "title": "Java JVM Garbage Collection Generations",
                "difficulty": "Easy",
                "category": "Java Architecture",
                "languages": ["Java"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["Java", "JVM", "Memory"],
                "description": "In the HotSpot JVM, where are newly allocated Java objects initially placed by default?",
                "options": [
                    "A. Eden space of the Young Generation",
                    "B. Old/Tenured Generation",
                    "C. Metaspace",
                    "D. Native Heap Thread Stack"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-03",
                "title": "Worst-Case Time Complexity of QuickSort",
                "difficulty": "Easy",
                "category": "Algorithms",
                "languages": ["Algorithms", "Python", "Java", "C++"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["Sorting", "Algorithms", "Big-O"],
                "description": "What is the worst-case time complexity of standard deterministic QuickSort when the pivot always partitions into empty and n-1 sub-arrays?",
                "options": [
                    "A. O(N^2)",
                    "B. O(N log N)",
                    "C. O(N)",
                    "D. O(log N)"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-04",
                "title": "SQL B-Tree Index vs Hash Index Range Scans",
                "difficulty": "Medium",
                "category": "Databases & SQL",
                "languages": ["SQL"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["SQL", "Indexing", "B-Tree", "Databases"],
                "description": "Why are B-Tree indexes preferred over Hash indexes for query predicates involving BETWEEN, <, and > range comparisons?",
                "options": [
                    "A. B-Trees maintain ordered key leaf nodes connected via bidirectional pointers",
                    "B. Hash indexes encrypt values preventing comparison operations",
                    "C. B-Trees use O(1) space while Hash indexes require O(N^2) memory",
                    "D. Hash indexes cannot store numeric values"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-05",
                "title": "HTTP Methods & RESTful Idempotency",
                "difficulty": "Easy",
                "category": "Web Systems & APIs",
                "languages": ["JavaScript", "Python", "Java"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["HTTP", "REST", "API Design"],
                "description": "Which of the following HTTP request methods is defined by RFC 7231 as NOT idempotent?",
                "options": [
                    "A. POST",
                    "B. GET",
                    "C. PUT",
                    "D. DELETE"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-06",
                "title": "C++ Virtual Table (vptr & vtable) Dispatch",
                "difficulty": "Medium",
                "category": "C++ Internals",
                "languages": ["C++"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["C++", "Polymorphism", "OOP"],
                "description": "How does C++ achieve runtime polymorphism for classes containing virtual member functions?",
                "options": [
                    "A. Through a compiler-generated virtual method table (vtable) and instance pointer (vptr)",
                    "B. By parsing class source text at runtime via JIT",
                    "C. Using dynamic reflection inspection on every invocation",
                    "D. By replacing function pointers during linking only"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-07",
                "title": "Binary Min-Heap Element Insertion Complexity",
                "difficulty": "Easy",
                "category": "Data Structures",
                "languages": ["Python", "Java", "C++"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["Heap", "Data Structures", "Priority Queue"],
                "description": "What is the worst-case time complexity of inserting a single element into a binary min-heap containing N elements?",
                "options": [
                    "A. O(log N)",
                    "B. O(1)",
                    "C. O(N)",
                    "D. O(N log N)"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-08",
                "title": "Concurrency: Mutex vs Counting Semaphore",
                "difficulty": "Hard",
                "category": "Operating Systems & Concurrency",
                "languages": ["C++", "Java", "Go"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["Concurrency", "Threading", "Synchronization"],
                "description": "What is the fundamental ownership distinction between a strict Mutex and a Binary Semaphore?",
                "options": [
                    "A. A Mutex must be unlocked by the exact same thread that acquired it; a Semaphore can be signaled by any thread",
                    "B. A Semaphore can only be used on single-core CPUs",
                    "C. A Mutex allows up to 5 concurrent threads by default",
                    "D. There is no difference; they are identical in POSIX"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-09",
                "title": "JavaScript Event Loop Task Scheduling Order",
                "difficulty": "Medium",
                "category": "JavaScript Architecture",
                "languages": ["JavaScript"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["JavaScript", "Event Loop", "Promises"],
                "description": "In Node.js / Browser event loop, when are Promise.then microtasks executed relative to setTimeout macrotasks?",
                "options": [
                    "A. Immediately after the currently executing script finishes, before the next macrotask is dequeued",
                    "B. Only after all setTimeout macrotasks in the queue have completed",
                    "C. In parallel on a separate operating system kernel thread",
                    "D. At exact 1-second intervals"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-10",
                "title": "Database Transaction Isolation: Phantom Read Phenomenon",
                "difficulty": "Hard",
                "category": "Databases & Transactions",
                "languages": ["SQL"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["SQL", "ACID", "Transactions", "Isolation"],
                "description": "Which standard ANSI/ISO SQL transaction isolation level guarantees complete protection against Phantom Reads?",
                "options": [
                    "A. Serializable",
                    "B. Read Committed",
                    "C. Read Uncommitted",
                    "D. Repeatable Read"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-11",
                "title": "Shortest Path Algorithm with Negative Edge Weights",
                "difficulty": "Hard",
                "category": "Graph Theory",
                "languages": ["Algorithms", "Python", "C++", "Java"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["Graph", "Dijkstra", "Bellman-Ford", "Algorithms"],
                "description": "Why cannot standard Dijkstra's algorithm be applied to directed graphs containing negative edge weights?",
                "options": [
                    "A. Dijkstra assumes visited nodes have finalized optimal distances and greedy choice property fails with negative edges",
                    "B. Priority queue implementations throw integer underflow errors on negative numbers",
                    "C. Negative weights produce infinite loops in all graphs regardless of cycles",
                    "D. Dijkstra only works on unweighted trees"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            },
            {
                "id": "mcq-12",
                "title": "Dynamic Programming: Memoization vs Tabulation",
                "difficulty": "Medium",
                "category": "Algorithms",
                "languages": ["Algorithms", "Python", "Java", "C++"],
                "question_type": "mcq",
                "points": 10,
                "tags": ["Dynamic Programming", "Memoization", "Tabulation"],
                "description": "What is the primary memory overhead risk associated with top-down Memoization compared to bottom-up Tabulation?",
                "options": [
                    "A. Call stack frame consumption that can trigger RecursionError/StackOverflow on deep states",
                    "B. Memoization requires O(2^N) hardware RAM allocation by the operating system",
                    "C. Tabulation cannot use arrays while memoization can",
                    "D. Memoization disables compiler CPU register optimization"
                ],
                "correct_option": 0,
                "sample_test_cases": [],
                "hidden_test_cases": []
            }
        ]

        for m in technical_mcqs:
            self._questions[m["id"]] = m

        logger.info(f"Initialized Unified Question Bank with {len(self._questions)} questions.")

    def get_all_questions(self) -> List[dict]:
        """Returns all questions in Question Bank."""
        return list(self._questions.values())

    def get_question_by_id(self, question_id: str) -> Optional[dict]:
        """Returns question details by ID."""
        return self._questions.get(question_id)

    def filter_questions(
        self,
        query: Optional[str] = None,
        language: Optional[str] = None,
        difficulty: Optional[str] = None,
        category: Optional[str] = None,
        question_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[dict], int]:
        """
        Filters questions across search terms, languages, difficulties, categories, and types.
        """
        results = []
        q_clean = query.strip().lower() if query else ""
        lang_clean = language.strip().lower() if language and language != "all" else None
        diff_clean = difficulty.strip().lower() if difficulty and difficulty != "all" else None
        cat_clean = category.strip().lower() if category and category != "all" else None
        type_clean = question_type.strip().lower() if question_type and question_type != "all" else None

        for q in self._questions.values():
            # Query match
            if q_clean:
                title_match = q_clean in q.get("title", "").lower()
                desc_match = q_clean in q.get("description", "").lower()
                tags_match = any(q_clean in t.lower() for t in q.get("tags", []))
                id_match = q_clean in q.get("id", "").lower()
                if not (title_match or desc_match or tags_match or id_match):
                    continue

            # Language match
            if lang_clean:
                langs = [l.lower() for l in q.get("languages", [])]
                if lang_clean not in langs:
                    continue

            # Difficulty match
            if diff_clean and q.get("difficulty", "").lower() != diff_clean:
                continue

            # Category match
            if cat_clean and cat_clean not in q.get("category", "").lower():
                continue

            # Question type match (coding vs mcq)
            if type_clean and q.get("question_type", "coding").lower() != type_clean:
                continue

            results.append(q)

        total_count = len(results)
        paged_results = results[offset: offset + limit]
        return paged_results, total_count

    def generate_questions_automatically(
        self,
        specifications: Dict[str, Dict[str, int]],
        mcq_count: int = 0
    ) -> List[dict]:
        """
        Strict automatic question generation matching exact counts per language and difficulty.
        Guarantees zero question duplication, validates availability, and raises clear errors
        if requested counts exceed available questions.
        """
        selected_questions: List[dict] = []
        used_ids = set()

        # 1. Process Coding Specifications: { "Python": {"Easy": 2, "Medium": 3, "Hard": 1}, ... }
        for lang, diff_counts in specifications.items():
            for diff, count in diff_counts.items():
                if count <= 0:
                    continue

                # Find available questions matching language and difficulty that have not been selected
                candidates = []
                for q in self._questions.values():
                    if q.get("question_type") != "coding":
                        continue
                    if q["id"] in used_ids:
                        continue
                    if q.get("difficulty", "").lower() != diff.lower():
                        continue
                    langs = [l.lower() for l in q.get("languages", [])]
                    if lang.lower() in langs or lang.lower() == "all":
                        candidates.append(q)

                if len(candidates) < count:
                    raise ValueError(
                        f"Insufficient questions in Question Bank for {lang} ({diff}): "
                        f"requested {count}, but only {len(candidates)} available."
                    )

                # Pick the requested count
                picked = candidates[:count]
                for p in picked:
                    used_ids.add(p["id"])
                    selected_questions.append(p)

        # 2. Process MCQs if requested
        if mcq_count > 0:
            mcq_candidates = [
                q for q in self._questions.values()
                if q.get("question_type") == "mcq" and q["id"] not in used_ids
            ]

            if len(mcq_candidates) < mcq_count:
                raise ValueError(
                    f"Insufficient MCQ questions in Question Bank: "
                    f"requested {mcq_count}, but only {len(mcq_candidates)} available."
                )

            picked_mcqs = mcq_candidates[:mcq_count]
            for m in picked_mcqs:
                used_ids.add(m["id"])
                selected_questions.append(m)

        return selected_questions


# Singleton Instance
question_bank_service = QuestionBankService()
