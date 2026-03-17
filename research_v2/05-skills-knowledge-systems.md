# Skills, Knowledge, and Self-Improvement Systems for AI Agents

> Research compiled 2026-03-16. Sources: academic papers, framework docs, blog posts, GitHub repos.

---

## 1. Skill and Capability Systems

### 1.1 The Spectrum of Skill Architectures

Agent skill systems fall on a spectrum from **static tool registries** (predefined functions the LLM can call) to **dynamic skill libraries** (learned, composable behaviors the agent acquires over time). Most production systems sit at the static end. The research frontier pushes toward the dynamic end.

### 1.2 Framework Comparison

#### AutoGen (Microsoft)

Three-layer architecture separating concerns:

| Layer | Purpose |
|-------|---------|
| **Core API** | Message passing, agent infrastructure |
| **AgentChat API** | High-level agent patterns (AssistantAgent, teams) |
| **Extensions API** | Specific implementations (OpenAI, code execution, MCP) |

**Tool definition** uses a flexible interface accepting raw functions, async functions, or formal `BaseTool` objects:

```python
# AutoGen auto-wraps plain functions into FunctionTool
# Name = function name, description = docstring, schema = type hints
tools: List[BaseTool | Callable | Callable[..., Awaitable]] = None

agent = AssistantAgent(
    name="assistant",
    tools=[my_function],           # auto-wrapped
    reflect_on_tool_use=True,      # LLM reflects on results
    max_tool_iterations=3,         # sequential tool-use cycles
)
```

**Agent-as-tool pattern** -- agents can be wrapped as tools for other agents:

```python
math_agent_tool = AgentTool(math_agent, return_value_as_last_message=True)
orchestrator = AssistantAgent(tools=[math_agent_tool])
```

**MCP integration** via `McpWorkbench`:

```python
async with McpWorkbench(server_params) as mcp:
    agent = AssistantAgent(name="browser", workbench=mcp)
```

#### LangGraph (LangChain)

Defines agents as state machines with tool nodes. Key pattern:

```python
# Tool binding
llm_with_tools = llm.bind_tools(tools)

# Tool node executes calls and wraps results
def tool_node(state: dict):
    result = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        result.append(ToolMessage(
            content=observation,
            tool_call_id=tool_call["id"]
        ))
    return {"messages": result}

# ReAct loop via conditional routing
def should_continue(state) -> Literal["tool_node", END]:
    if state["messages"][-1].tool_calls:
        return "tool_node"
    return END
```

State management uses `MessagesState` -- conversation history + tool metadata persist across loops. The graph structure makes it explicit where tools execute and how results flow back.

#### DSPy (Stanford)

Takes a fundamentally different approach -- **programmatic prompt optimization** instead of manual prompt/tool engineering:

- **Signatures**: Declarative input-output contracts (no manual prompts)
- **Modules**: Composable building blocks for LM interactions
- **Optimizers** (formerly Teleprompters): Algorithms that automatically optimize prompts and weights

Key insight: DSPy treats the prompt itself as a learnable parameter. The system compiles declarative specs into "self-improving pipelines." Recent research (2025) shows reflective prompt evolution can outperform reinforcement learning for optimization.

### 1.3 Model Context Protocol (MCP)

MCP is the emerging standard for skill extension. Architecture:

```
MCP Host (AI Application)
  |-- MCP Client 1 --> MCP Server A (local, stdio)
  |-- MCP Client 2 --> MCP Server B (local, stdio)
  |-- MCP Client 3 --> MCP Server C (remote, HTTP+SSE)
```

**Two layers:**

| Layer | Purpose |
|-------|---------|
| **Data layer** | JSON-RPC 2.0 protocol: lifecycle, primitives, notifications |
| **Transport layer** | Communication: stdio (local) or Streamable HTTP (remote) |

**Three server primitives:**

1. **Tools** -- executable functions (`tools/list`, `tools/call`)
2. **Resources** -- data sources for context (`resources/list`, `resources/read`)
3. **Prompts** -- reusable interaction templates (`prompts/list`, `prompts/get`)

**Lifecycle:**

```json
// 1. Client sends initialize with its capabilities
{"method": "initialize", "params": {"capabilities": {"elicitation": {}}}}

// 2. Server responds with its capabilities
{"result": {"capabilities": {"tools": {"listChanged": true}, "resources": {}}}}

// 3. Client confirms
{"method": "notifications/initialized"}

// 4. Dynamic tool discovery
{"method": "tools/list"} -> returns tool schemas (name, description, inputSchema)

// 5. Tool execution
{"method": "tools/call", "params": {"name": "weather_current", "arguments": {...}}}
```

**Why MCP matters for skill systems:** It decouples skill definition from the agent. Skills become standalone servers that any MCP-compatible agent can discover and use. Dynamic `listChanged` notifications mean the skill set can evolve at runtime without agent restart.

**Implementation pattern for skill extension:**

```python
# Pseudo-code: aggregate tools from all MCP servers
available_tools = []
for session in app.mcp_server_sessions():
    tools_response = await session.list_tools()
    available_tools.extend(tools_response.tools)
conversation.register_available_tools(available_tools)

# Handle dynamic updates
async def handle_tools_changed_notification(session):
    tools_response = await session.list_tools()
    app.update_available_tools(session, tools_response.tools)
```

### 1.4 Anthropic's Agent Orchestration Patterns

From "Building Effective Agents" (Anthropic, 2025). Key distinction: **workflows** (predefined code paths) vs **agents** (LLM-directed processes).

**Five orchestration patterns, ordered by complexity:**

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Prompt Chaining** | Fixed subtask sequence, accuracy > latency | Generate outline -> write document |
| **Routing** | Distinct input categories need different handling | Customer service triage |
| **Parallelization** | Independent subtasks or voting for confidence | Guardrails + response in parallel |
| **Orchestrator-Workers** | Subtasks can't be predicted in advance | Multi-file code changes |
| **Evaluator-Optimizer** | Clear eval criteria, iterative refinement helps | Translation with nuance |

**Tool design principles (Agent-Computer Interface):**

- Treat tool documentation like API documentation -- include examples, edge cases, boundaries
- Use absolute paths over relative paths to prevent navigation errors
- Apply poka-yoke (error-proofing) to argument structures
- Test tool definitions extensively before deployment
- Keep formats close to patterns the model has seen in training data

**Decision framework:** Start simple. Optimize single LLM calls first. Add workflows when structure is known. Deploy agents only for genuinely open-ended problems.

---

## 2. Knowledge Systems

### 2.1 RAG and Its Limitations

Standard RAG pipeline:

```
Documents -> Chunk -> Embed -> Vector Store
Query -> Embed -> Similarity Search -> Top-K chunks -> LLM + chunks -> Answer
```

**Fundamental limitations:**

1. **No global reasoning** -- can only retrieve chunks similar to the query, cannot synthesize across the corpus
2. **Lost relationships** -- chunking destroys the relationship structure between entities
3. **Context window waste** -- retrieved chunks may contain irrelevant surrounding text
4. **No reasoning about absence** -- can't answer "what is NOT in the data?"
5. **Semantic gap** -- embedding similarity != relevance for the actual task

### 2.2 GraphRAG (Microsoft Research)

Addresses RAG's global reasoning limitation through knowledge graphs + community detection.

**Two-stage indexing pipeline:**

1. **Entity & relationship extraction** -- LLM extracts entities and relationships from source text, building a knowledge graph
2. **Community detection** -- Leiden algorithm partitions the graph hierarchically into communities of densely connected nodes
3. **Community summarization** -- Pre-generate summaries for each community at multiple levels (high-level themes -> low-level topics)

**Three query modes:**

| Mode | How It Works | Best For |
|------|--------------|----------|
| **Global Search** | Map-reduce over community summaries | "What are the main themes?" -- corpus-wide questions |
| **Local Search** | Expand from specific entities to their neighbors | "Tell me about X" -- entity-focused questions |
| **DRIFT Search** | Combines entity exploration with community context | Hybrid questions |

**Global search detail:**

```
Community summaries -> Group within context limits ->
Map: apply question to each group -> partial answers ->
Reduce: synthesize partial answers -> final answer
```

**Performance:** 70-80% win rate over naive RAG on comprehensiveness/diversity. Uses 20-70% fewer tokens per query compared to full-text summarization.

**Cost tradeoff:** Significant upfront indexing cost (LLM calls for entity extraction + summarization). Active research into reducing this via NLP-based graph approximation and automatic prompt tuning.

### 2.3 LlamaIndex: Knowledge Framework Patterns

Three-layer knowledge pipeline:

1. **Data Ingestion** -- connectors for PDFs, APIs, SQL, docs (300+ packages)
2. **Data Structuring** -- indices and graphs for LLM consumption
3. **Retrieval Interface** -- query engines that retrieve context and return augmented output

```python
# Basic index construction
documents = SimpleDirectoryReader("data/").load_data()
index = VectorStoreIndex.from_documents(documents)

# Persistence
index.storage_context.persist()

# Reload
storage = StorageContext.from_defaults(persist_dir="storage/")
index = load_index_from_storage(storage)
```

Key pattern: **modular namespace design** separating core from integrations (`llama_index.core.xxx` vs `llama_index.llms.openai`).

### 2.4 Procedural Knowledge

Most knowledge systems handle **declarative knowledge** (facts). Procedural knowledge -- how to do things -- is harder. Three approaches in the wild:

1. **Skill-as-code** (Voyager pattern): Store executable code snippets with natural language descriptions. Retrieve by embedding similarity on description.

2. **Episodic memory** (Reflexion pattern): Store records of past task attempts including what worked and what didn't. Retrieve relevant episodes when facing similar tasks.

3. **System prompt evolution** (DSPy pattern): Encode procedures directly in optimized prompts. Let the optimizer learn the best way to express procedures.

---

## 3. Self-Improvement and Learning

### 3.1 Voyager: The Skill Library Paradigm

Voyager (NVIDIA/MineDojo, 2023) is the canonical example of an agent that builds a growing library of reusable skills.

**Architecture (three components):**

```
Automatic Curriculum          Skill Library            Iterative Prompting
(what to learn next)    (store & retrieve skills)    (how to write code)
        |                        |                          |
        v                        v                          v
   Propose task  ->  Retrieve relevant skills  ->  Generate code  ->
                                                   Execute  ->
                                                   Verify  ->
                                                   If fail: retry with error feedback
                                                   If pass: add to skill library
```

**Skill library implementation:**

- Skills are **JavaScript functions** (Mineflayer API calls) stored as executable code
- Each skill has a **natural language description** embedded alongside it
- **Retrieval**: query description is embedded, cosine similarity finds relevant existing skills
- **Composition**: retrieved skills are injected into the prompt as available functions the new code can call
- Skills are "temporally extended, interpretable, and compositional"

**Key properties:**

| Property | Why It Matters |
|----------|---------------|
| **Temporally extended** | Skills can represent multi-step behaviors, not just single actions |
| **Interpretable** | Code is human-readable, debuggable |
| **Compositional** | New skills can call existing skills, compounding capability |
| **No catastrophic forgetting** | Skills persist in library; adding new ones doesn't erase old ones |

**Self-verification loop:**

```
Generate code -> Execute in environment -> Check for errors ->
If error: feed error back to LLM, regenerate ->
If no error: run self-verification (did the task succeed?) ->
If verified: commit to skill library with description
```

**Transfer:** The learned skill library transfers to new Minecraft worlds -- the agent applies previously learned skills to novel tasks without retraining. Competing methods (ReAct, AutoGPT-style) fail at this because they don't persist learned behaviors.

**Performance:** 3.3x more unique items, 2.3x longer travel distances, 15.3x faster tech tree progression vs. prior approaches.

### 3.2 Reflexion: Learning from Mistakes

Reflexion (Shinn et al., 2023) introduces **linguistic self-reflection** as a learning mechanism.

**Core loop:**

```
Attempt task -> Receive feedback (binary reward or environment signal) ->
Generate verbal reflection ("I failed because...") ->
Store reflection in episodic memory buffer ->
Next attempt: include past reflections in context ->
Repeat until success or max trials
```

**Key insight:** The agent's own natural language reflections serve as a form of learning that persists across attempts without weight updates. The reflection buffer acts as a lightweight episodic memory.

**Implementation pattern:**

```python
# Pseudo-code for Reflexion loop
memory = []
for trial in range(max_trials):
    result = agent.attempt(task, context=memory)
    if result.success:
        break
    reflection = agent.reflect(task, result, memory)
    memory.append(reflection)
```

**Performance:** 91% pass@1 on HumanEval (vs 80% for GPT-4 without reflection). Works across sequential decision-making, coding, and language reasoning tasks.

### 3.3 Generative Agents: Memory-Driven Behavior

Stanford's Generative Agents (Park et al., 2023) -- 25 autonomous characters in a simulation:

**Memory architecture:**

- **Memory stream**: Natural language records of experiences
- **Retrieval model**: Scores memories on three axes:
  - **Recency** -- exponential decay
  - **Importance** -- LLM-rated significance (1-10)
  - **Relevance** -- embedding similarity to current situation
- **Reflection**: Periodically synthesize observations into higher-level inferences
- **Planning**: Translate reflections into behavioral plans

**Retrieval scoring:**

```
score(memory) = α * recency(memory) + β * importance(memory) + γ * relevance(memory, query)
```

This three-factor scoring is a powerful pattern for any agent memory system -- it balances what's recent, what's important, and what's relevant to the current task.

### 3.4 DSPy: Automated Prompt Optimization

DSPy treats prompts as learnable parameters rather than hand-crafted strings.

**Programming model:**

```python
# Define what the module does (not how)
class RAG(dspy.Module):
    def __init__(self):
        self.retrieve = dspy.Retrieve(k=3)
        self.generate = dspy.ChainOfThought("context, question -> answer")

    def forward(self, question):
        context = self.retrieve(question)
        return self.generate(context=context, question=question)

# Compile with an optimizer
optimizer = dspy.BootstrapFewShot(metric=answer_exact_match)
compiled_rag = optimizer.compile(RAG(), trainset=examples)
```

The optimizer automatically discovers effective few-shot examples, instructions, and reasoning patterns. The compiled module contains optimized prompts that the developer never had to write manually.

**Self-improvement pattern:** Run the optimizer periodically on new data to refine prompts. The system improves itself by learning from its own successes and failures.

---

## 4. Context Engineering

### 4.1 Definition and Scope

Context engineering (term popularized by Tobi Lutke / Shopify, formalized by Andrej Karpathy) is:

> "The art of providing all the context for the task to be plausibly solvable by the LLM."

It supersedes "prompt engineering" because production AI systems require managing much more than a single prompt string.

### 4.2 The Seven Context Components

| Component | What It Provides |
|-----------|-----------------|
| **Instructions / System Prompt** | Behavioral guidelines, rules, examples |
| **User Prompt** | The immediate task |
| **State / History** | Conversation memory, prior exchanges |
| **Long-Term Memory** | Persistent knowledge across sessions |
| **Retrieved Information (RAG)** | External data from docs, APIs, databases |
| **Available Tools** | Function definitions the model can invoke |
| **Structured Output** | Response format specifications |

**Core insight from Anthropic + LangChain research:** "Agent failures aren't model failures; they are context failures." The model is only as good as the context it receives.

### 4.3 MemGPT: OS-Inspired Context Management

MemGPT (Packer et al., 2023) treats the context window as virtual memory, drawing from OS memory hierarchies.

**Memory tiers:**

| Tier | Analogy | Purpose | Access |
|------|---------|---------|--------|
| **Core Memory** | RAM / registers | Active working context the agent reads every turn | Always in context |
| **Recall Memory** | Disk cache | Searchable conversation history | Retrieved via function calls |
| **Archival Memory** | Cold storage | Long-term knowledge store, unlimited size | Retrieved via function calls |

**Key mechanism:** The LLM manages its own memory through function calls:

```
# The agent has built-in memory tools:
core_memory_append(key, value)    # Add to working context
core_memory_replace(key, old, new) # Edit working context
archival_memory_insert(content)    # Store for later
archival_memory_search(query)      # Retrieve from storage
conversation_search(query)         # Search past messages
```

**Virtual context management:** Data moves between fast memory (context window) and slow memory (external storage) based on the agent's own decisions. The agent decides what to keep, what to archive, and what to retrieve -- analogous to a program managing its own memory via system calls.

**Interrupt-based control flow:** The system uses interrupts to manage when the agent needs to page in new context vs. continue with current context.

### 4.4 LangChain's Memory Taxonomy

Three types of agent memory mapped to cognitive science:

| Type | Cognitive Analog | Agent Implementation | Update Pattern |
|------|-----------------|---------------------|----------------|
| **Procedural** | How to ride a bike | LLM weights + agent code | Rarely updated (retraining) |
| **Semantic** | Facts about the world | Extracted facts from conversations | Hot path (tool call) or background process |
| **Episodic** | Memory of past events | Few-shot examples from past task attempts | After task completion |

**Two update strategies:**

1. **Hot path**: Agent explicitly decides to remember via tool call before responding. Adds latency but ensures immediate updates.
2. **Background**: Separate process extracts and stores memories during/after conversations. No latency cost but delayed updates.

**Design principle:** What and how to remember varies by application. A coding agent remembers library preferences; a research agent remembers industry context. Memory architecture must be application-specific.

### 4.5 The Context Window as Working Memory

The context window is the agent's working memory -- it determines what the agent can reason about at any given moment. Key patterns for managing it:

**1. Salience-based retrieval:**

Don't retrieve everything related to a query. Score by multiple factors:
- Recency (when was this last relevant?)
- Importance (how significant is this?)
- Relevance (how related to current task?)

**2. Hierarchical summarization:**

As conversations grow, compress old messages into summaries. Keep recent messages verbatim, older ones as summaries, oldest as high-level context.

**3. Dynamic tool filtering:**

Don't load all available tools into context. Route the query first, then load only relevant tool definitions. Each tool definition consumes tokens.

**4. Context compilation (Letta pattern):**

Before each LLM call, compile the context from components:
- System prompt (static)
- Core memory blocks (agent-managed, semi-static)
- Retrieved archival/recall memories (dynamic)
- Recent conversation history (dynamic)
- Available tools for this turn (dynamic)

**5. Proactive vs. reactive context loading:**

- **Reactive**: Load context when the agent asks for it (tool call -> retrieval)
- **Proactive**: Anticipate what context will be needed and pre-load it

---

## 5. Implementation Patterns for Lucy

### 5.1 Skill System Design

Based on this research, a practical skill system for Lucy could combine:

**MCP for external skills** (already in use via Pi SDK):
- Each skill = an MCP server with tools, resources, and prompts
- Dynamic discovery via `tools/list`
- Hot-reloadable via `listChanged` notifications

**Voyager-inspired skill library for learned behaviors:**

```typescript
interface Skill {
  name: string;
  description: string;          // natural language, used for retrieval
  code: string;                 // executable implementation
  embedding: number[];          // description embedding for similarity search
  verified: boolean;            // has this been validated?
  usageCount: number;           // how often has it been used?
  lastUsed: Date;
  dependencies: string[];       // other skills this builds on
}

// Retrieval: embed the current task description, find top-K similar skills
// Injection: include retrieved skill code in the prompt as available functions
// Verification: after execution, validate the result before committing
```

**Reflexion-inspired learning:**

```typescript
interface Reflection {
  taskDescription: string;
  attempt: number;
  outcome: "success" | "failure";
  reflection: string;           // agent's own analysis of what happened
  timestamp: Date;
}

// Before each task: retrieve relevant past reflections
// After failure: generate reflection, store it
// After success: optionally extract a reusable skill
```

### 5.2 Knowledge Architecture

**Tiered approach:**

| Tier | Contents | Access Pattern |
|------|----------|----------------|
| **Core memory** | User preferences, active project context, persona | Always in context |
| **Episodic memory** | Past conversation summaries, task outcomes | Retrieved by relevance + recency |
| **Semantic memory** | Facts, entities, relationships | Retrieved by query similarity |
| **Procedural memory** | Skills, learned behaviors, optimized prompts | Retrieved by task description similarity |

### 5.3 Context Engineering Checklist

For each LLM call, ensure the context contains:

- [ ] System prompt with agent identity and behavioral rules
- [ ] Core memory blocks (user profile, active context)
- [ ] Retrieved memories relevant to the current query (scored by recency + importance + relevance)
- [ ] Only the tool definitions needed for this specific task
- [ ] Recent conversation history (verbatim for last N turns, summarized for older)
- [ ] Any active task/plan context
- [ ] Output format specification if structured output is needed

### 5.4 Self-Improvement Loop

```
Task arrives ->
  1. Retrieve relevant skills from library
  2. Retrieve relevant past reflections
  3. Attempt task with augmented context
  4. Evaluate outcome
  5. If failure: generate reflection, store it, retry with reflection
  6. If success: extract reusable skill if novel behavior was used
  7. Update memory (semantic facts, episodic record)
```

---

## 6. Key Takeaways

1. **Skills are just well-documented tools.** The difference between a "skill" and a "tool" is persistence and learnability. MCP provides the standardized interface; what matters is whether the agent can grow its skill set.

2. **Memory is not monolithic.** Separate procedural (how), semantic (what), and episodic (when) memory. Each has different storage, retrieval, and update patterns.

3. **Context engineering > prompt engineering.** The context window is the agent's working memory. Managing what goes in it -- and what stays out -- determines agent quality more than model choice.

4. **Self-improvement requires structured feedback loops.** Reflexion (verbal self-critique) and Voyager (skill verification) both work because they create tight feedback loops between action and learning.

5. **Start static, go dynamic.** Begin with hand-crafted tools and prompts. Add retrieval-based memory. Only then attempt self-improving skill acquisition. Each layer adds complexity.

6. **GraphRAG for knowledge, vector RAG for retrieval.** If you need to reason across a corpus (global questions), build a knowledge graph. If you need to find specific passages, vector similarity suffices.

7. **The agent should manage its own memory.** MemGPT's core insight: give the agent memory tools and let it decide what to remember, archive, and retrieve. This scales better than external heuristics.

---

## Sources

- Voyager (Wang et al., 2023): https://arxiv.org/abs/2305.16291
- Reflexion (Shinn et al., 2023): https://arxiv.org/abs/2303.11366
- MemGPT (Packer et al., 2023): https://arxiv.org/abs/2310.08560
- GraphRAG (Microsoft, 2024): https://arxiv.org/abs/2404.16130
- Generative Agents (Park et al., 2023): https://arxiv.org/abs/2304.03442
- LLM Powered Agents (Lilian Weng, 2023): https://lilianweng.github.io/posts/2023-06-23-agent/
- Building Effective Agents (Anthropic, 2025): https://www.anthropic.com/engineering/building-effective-agents
- MCP Specification: https://modelcontextprotocol.io/docs/learn/architecture
- AutoGen: https://github.com/microsoft/autogen
- LangGraph: https://github.com/langchain-ai/langgraph
- DSPy: https://github.com/stanfordnlp/dspy
- LlamaIndex: https://github.com/run-llama/llama_index
- LangChain Memory Blog: https://blog.langchain.com/memory-for-agents
- Context Engineering (Phil Schmid): https://www.philschmid.de/context-engineering
