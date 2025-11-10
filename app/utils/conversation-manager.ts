export interface ConversationMessage {
  from: 'bot' | 'user';
  text: string;
  timestamp: number;
}

export class ConversationManager {
  private questions: string[];
  private currentIndex: number = 0;
  private conversation: ConversationMessage[] = [];
  private startTime: number = Date.now();
  private waitingForResponse: boolean = false;
  private lastQuestionTime: number = 0;

  constructor(questions: string[]) {
    this.questions = questions;
  }

  async askNextQuestion(): Promise<string | null> {
    if (this.currentIndex >= this.questions.length) {
      return null; // Interview complete
    }
    
    const question = this.questions[this.currentIndex];
    this.currentIndex++;
    this.waitingForResponse = true;
    this.lastQuestionTime = Date.now();
    
    this.conversation.push({ 
      from: 'bot', 
      text: question,
      timestamp: Date.now()
    });
    
    return question;
  }

  addUserResponse(response: string) {
    this.waitingForResponse = false;
    this.conversation.push({ 
      from: 'user', 
      text: response,
      timestamp: Date.now()
    });
  }

  getPromptForNoResponse(): string {
    const prompts = [
      "I'm waiting for your response. Please go ahead and answer.",
      "Take your time, but I'd like to hear your thoughts on this.",
      "Feel free to share your answer whenever you're ready.",
      "I'm here when you're ready to respond."
    ];
    
    // Use different prompts based on how long we've been waiting
    const waitTime = Date.now() - this.lastQuestionTime;
    if (waitTime > 30000) { // 30 seconds
      return prompts[1]; // More encouraging
    } else if (waitTime > 20000) { // 20 seconds
      return prompts[2]; // Gentle reminder
    } else {
      return prompts[0]; // Standard prompt
    }
  }

  getTransitionPhrase(): string {
    const transitions = [
      "Thank you for that answer.",
      "I appreciate your response.",
      "That's helpful, thank you.",
      "Good to know.",
      "Interesting perspective."
    ];
    return transitions[Math.floor(Math.random() * transitions.length)];
  }

  isWaitingForResponse(): boolean {
    return this.waitingForResponse;
  }

  getTimeSinceLastQuestion(): number {
    return this.lastQuestionTime > 0 ? Date.now() - this.lastQuestionTime : 0;
  }

  getConversation(): ConversationMessage[] {
    return this.conversation;
  }

  getCurrentQuestionIndex(): number {
    return this.currentIndex;
  }

  getTotalQuestions(): number {
    return this.questions.length;
  }

  isComplete(): boolean {
    return this.currentIndex >= this.questions.length;
  }

  getProgress(): { current: number; total: number; percentage: number } {
    return {
      current: this.currentIndex,
      total: this.questions.length,
      percentage: Math.round((this.currentIndex / this.questions.length) * 100)
    };
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  reset() {
    this.currentIndex = 0;
    this.conversation = [];
    this.startTime = Date.now();
    this.waitingForResponse = false;
    this.lastQuestionTime = 0;
  }
}

