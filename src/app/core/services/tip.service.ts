import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { Tip, TipGenerationRequest, TipTelegramPayload } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TipService {
  private readonly STORAGE_KEY = 'truora_tips';

  constructor(private http: HttpClient) {}

  generateTipImage(request: TipGenerationRequest): Observable<string> {
    // Simular generación de imagen con canvas
    return new Observable(observer => {
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          observer.error('Canvas not supported');
          return;
        }

        // Cargar imagen de bombilla primero
        const img = new Image();
        img.onload = () => {
          // Dibujar fondo morado vibrante
          ctx.fillStyle = '#6B46C1';
          ctx.fillRect(0, 0, 800, 600);

          // Dibujar la imagen de la bombilla con transparencia en la esquina superior izquierda
          ctx.drawImage(img, 30, 70, 100, 100);
          
          // Continuar con el resto del diseño
          drawRestOfDesign();
        };
        img.onerror = () => {
          // Si falla la carga, dibujar el fondo y el resto sin la imagen
          ctx.fillStyle = '#6B46C1';
          ctx.fillRect(0, 0, 800, 600);
          drawRestOfDesign();
        };
        img.src = 'assets/images/bombilloTip.png';

        const drawRestOfDesign = () => {
          // Cargar imagen wraperTitle para el título
          const titleImg = new Image();
          titleImg.onload = () => {
            // Dibujar la imagen wraperTitle en la posición del título
            ctx.drawImage(titleImg, 260, 90, 480, 100);
            
            // Texto del título superpuesto en la imagen wraperTitle
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(request.title.toUpperCase(), 500, 140);
            
            continueDrawing();
          };
          titleImg.onerror = () => {
            // Si falla la carga de wraperTitle, usar el óvalo negro como fallback
            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 5;
            
            ctx.beginPath();
            ctx.ellipse(500, 140, 240, 50, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(request.title.toUpperCase(), 500, 140);
            
            continueDrawing();
          };
          titleImg.src = 'assets/images/wraperTitle.png';
        };

        const continueDrawing = () => {
          // Flecha dibujada a mano (lado izquierdo inferior)
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 4;
          
          ctx.beginPath();
          // Línea principal de la flecha
          ctx.moveTo(50, 520);
          ctx.quadraticCurveTo(80, 540, 100, 570);
          ctx.stroke();
          
          // Punta de la flecha
          ctx.beginPath();
          ctx.moveTo(100, 570);
          ctx.lineTo(110, 555);
          ctx.moveTo(100, 570);
          ctx.lineTo(85, 565);
          ctx.stroke();

          // Logo Truora en la esquina inferior izquierda
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 32px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('Truora', 50, 550);

          // Contenido del tip (centro)
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '26px Arial';
          ctx.textAlign = 'left';
          const words = request.topic.split(' ');
          let line = '';
          let y = 320;
          const maxWidth = 700;
          
          words.forEach(word => {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, 50, y);
              line = word + ' ';
              y += 40;
            } else {
              line = testLine;
            }
          });
          ctx.fillText(line, 50, y);

          // Firma del líder
          ctx.fillStyle = '#E0E0E0';
          ctx.font = 'italic 20px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(`— ${request.leaderName}`, 50, y + 80);

          // Fecha
          ctx.fillText(new Date().toLocaleDateString('es-ES'), 50, y + 110);

          const imageData = canvas.toDataURL('image/png');
          observer.next(imageData);
          observer.complete();
        };
      }, 1500);
    });
  }

  sendToTelegram(tip: Tip): Observable<any> {
    if (!environment.n8nWebhookUrl) {
      // Simular envío exitoso en desarrollo
      return of({ success: true, message: 'Tip enviado a Telegram (modo demo)' }).pipe(delay(1000));
    }

    // Quitar el prefijo 'data:image/png;base64,' del base64
    const base64Data = tip.imageData.split(',')[1] || tip.imageData;

    // Enviar datos como JSON con imagen en base64 limpio
    const payload = {
      image: base64Data,
      title: tip.title,
      topic: tip.topic,
      leaderName: tip.leaderName,
      timestamp: tip.createdAt.toISOString()
    };

    return this.http.post(environment.n8nWebhookUrl, payload);
  }

  private base64ToBlob(base64: string, contentType: string = ''): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  }

  saveTip(tip: Tip): void {
    const tips = this.getTips();
    tips.push(tip);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tips));
  }

  getTips(): Tip[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  deleteTip(id: string): boolean {
    const tips = this.getTips();
    const filtered = tips.filter(t => t.id !== id);
    if (filtered.length === tips.length) return false;
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
}
