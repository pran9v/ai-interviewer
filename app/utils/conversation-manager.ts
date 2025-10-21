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

  constructor(questions: string[]) {
    this.questions = questions;
  }

  async askNextQuestion(): Promise<string | null> {
    if (this.currentIndex >= this.questions.length) {
      return null; // Interview complete
    }
    
    const question = this.questions[this.currentIndex];
    this.currentIndex++;
    
    this.conversation.push({ 
      from: 'bot', 
      text: question,
      timestamp: Date.now()
    });
    
    return question;
  }

  addUserResponse(response: string) {
    this.conversation.push({ 
      from: 'user', 
      text: response,
      timestamp: Date.now()
    });
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
  }
}

